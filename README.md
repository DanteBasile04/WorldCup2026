# World Cup 2026

Next.js App Router application connected to Supabase with public read-only data.

## Local workflow boundary

This repo now uses a **partial Bun migration** for local development:

| Use case | Recommended command path |
|---|---|
| App install / dev / lint / build | `bun install`, `bun dev`, `bun run lint`, `bun run build` |
| OCR / import / export / data scripts in `scripts/` | `node scripts/...` |
| Rollback / fallback | Existing `pnpm` workflow still works while this stays a partial migration |

`pnpm-lock.yaml` stays in the repo as the current rollback artifact. `bun.lock` is intentionally local-only for now so this migration stays small and reversible.

## Quick path

```bash
bun install
cp .env.example .env.local
bun dev
```

Set these variables in `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xenpsrdxdozzlszaktwa.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=tu_publishable_key
```

## Verification

```bash
bun run lint
bun run build
```

## Deploy to Vercel

Use the pinned production path documented in [`docs/deployment-vercel-supabase.md`](docs/deployment-vercel-supabase.md).

- Vercel install command: `pnpm install --frozen-lockfile`
- Vercel build command: `pnpm build`
- Runtime variables in Vercel: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- Local-only write secret: `SUPABASE_COUNTRY_IMPORT_KEY` stays out of Vercel for the current app deploy

## Initial team import

Generate a CSV with the qualified teams so it can be imported manually into `public.country` in Supabase:

```bash
node scripts/import-qualified-countries.mjs --dry-run
node scripts/import-qualified-countries.mjs
```

The script generates `generated/countries-import.csv` with these columns:

- `name`
- `federation`
- `flag_url`
- `flag_storage_path`
- `emblem_url`
- `emblem_storage_path`

It still does not include `slug` because the database generates it, and it does not touch optional fields such as `colors`, `story`, `trophies`, or `formation`.

### Import into Supabase

1. Run `node scripts/import-qualified-countries.mjs`.
2. Open Supabase Dashboard → **Table Editor** → `country`.
3. Choose **Insert** → **Import data from CSV**.
4. Upload `generated/countries-import.csv`.
5. Confirm the mapping for `name`, `federation`, `flag_url`, `flag_storage_path`, `emblem_url`, and `emblem_storage_path`.
6. Let Supabase generate `slug` automatically.

If some rows were imported before this change and are still missing `flag_storage_path` or `emblem_storage_path`, the smallest safe backfill is to run:

```bash
node scripts/import-qualified-countries.mjs --write
```

That direct-write mode now fills the storage-path columns using the same `flags/<slug>.svg` and `emblems/<slug>.svg` convention the app already resolves first, without requiring `--overwrite-media`.

If you want the script to write directly into Supabase:

```bash
node scripts/import-qualified-countries.mjs --write
```

That mode still reads the 2026 qualified teams from Wikipedia, uses Wikimedia URLs for flags, and resolves likely emblems from team pages. By default it preserves already loaded data; use `--overwrite-media` only when you intentionally want to replace media values.

## Formation generator and upload

The formation pipeline now persists two artifacts for each team:

- `public.country.formation` stores the published inline SVG used by the current app read path.
- `public.country.formation_json` stores the structured formation document for future UI rendering and queries.

See [`docs/formation-persistence.md`](docs/formation-persistence.md) for the migration, storage contract, and batch upload commands.

## Shirt-number import

See [`docs/shirt-number-import.md`](docs/shirt-number-import.md) for the migration, prerequisites, dry-run flow, and real import command.

### Base example

```bash
node scripts/generate-formation-svg.mjs --input samples/formation-mexico-input.json --json-output generated/formation-mexico-example.json --svg-output generated/formation-mexico-example.svg
node scripts/generate-country-formation-update.mjs --input samples/country-formation-mexico-input.json
```

This reads `samples/formation-mexico-input.json` and generates:

- `generated/formation-mexico-example.json`
- `generated/formation-mexico-example.svg`

The `formation:country-update` flow reads `samples/country-formation-mexico-input.json` and generates:

- `generated/mexico-formation-update.json`
- `generated/mexico-formation-update.svg`
- `generated/mexico-formation-update.sql`

Use it when your contract is:

**country + formation + players -> artifact ready for Supabase**

```bash
node scripts/generate-country-formation-update.mjs --input samples/country-formation-mexico-input.json
```

You can also point to another JSON file and change the output directory:

```bash
node scripts/generate-country-formation-update.mjs \
  --input samples/country-formation-mexico-input.json \
  --output-dir generated/custom
```

### Local preview before export

If you want to inspect the formation before exporting or writing it to the database:

```bash
node scripts/preview-formation.mjs --input samples/country-formation-mexico-input.json --open
```

That generates a local HTML page and opens it in the browser.

It also accepts text authoring input:

```bash
node scripts/preview-formation.mjs --text "mexico 4-3-3
1 Guillermo Ochoa GK
2 | Julian Araujo | DF | Araujo | RB
3 | Cesar Montes | DF | Montes | RCB
4 | Johan Vazquez | DF | Vazquez | LCB
5 | Jesus Gallardo | DF | Gallardo | LB
6 | Edson Alvarez | MF | Alvarez | DM
7 | Luis Chavez | MF | Chavez | LCM
8 | Hector Herrera | MF | Herrera | RCM
9 | Santiago Gimenez | FW | Gimenez | ST
10 | Alexis Vega | FW | Vega | LW
11 | Hirving Lozano | FW | Lozano | RW" --open

node scripts/preview-formation.mjs --slug mexico --formation 4-3-3 --players "1,Guillermo Ochoa,GK,Ochoa,GK;2,Julian Araujo,DF,Araujo,RB;3,Cesar Montes,DF,Montes,RCB;4,Johan Vazquez,DF,Vazquez,LCB;5,Jesus Gallardo,DF,Gallardo,LB;6,Edson Alvarez,MF,Alvarez,DM;7,Luis Chavez,MF,Chavez,LCM;8,Hector Herrera,MF,Herrera,RCM;9,Santiago Gimenez,FW,Gimenez,ST;10,Alexis Vega,FW,Vega,LW;11,Hirving Lozano,FW,Lozano,RW" --open
```

Useful flags:

- `--open` → open the preview in the browser
- `--output <path>` → write the HTML to another path
- `--stdout` → print the HTML
- `--stdin` → read authoring text from stdin

By default the script writes to `generated/preview-formation.html`.

### Input structure

```json
{
  "country": { "slug": "mexico", "name": "Mexico" },
  "team": { "name": "Mexico", "formation": "4-1-2-3" },
  "players": [
    { "number": 1, "name": "Raul RANGEL", "role": "GK", "label": "Rangel", "slot": "GK" }
  ]
}
```

Text authoring rows support both formats:

```text
mexico 4-3-3
1 Guillermo Ochoa GK
2 | Julian Araujo | DF | Araujo | RB
3 | Cesar Montes | DF | Montes | RCB
```

Rules:

- `country.slug` is the best identifier for SQL generation
- `country.name` is the fallback identifier
- `team.name` and `team.formation` are required
- `players` is required
- `label` is optional in JSON and text, and defaults to `name`
- `slot` is optional, but recommended when you want durable placement stability
- Legacy text rows still support `<number> <name> <role>`
- Extended text rows support `<number> | <full name> | <role> | <short label> | <slot>`

### Supported layouts

- `4-1-2-3`
- `4-4-2`
- `4-3-3`
- `4-4-1-1`
- `4-1-4-1`
- `4-2-2-2`
- `4-2-3-1`
- `3-4-3`
- `3-5-2`
- `4-3-1-2`
- `3-2-4-1`
- `5-3-2`
- `5-2-3`

If the formation is not supported, the script fails with a clear error listing the valid options.

### PDF / match-summary compatibility

The legacy FIFA Match Summary flow still exists as an optional adapter:

```bash
node scripts/extract-match-summary-formation.mjs
node scripts/extract-match-summary-formation.mjs --lineup-file path/to/formation.txt
```

That wrapper converts the text into the same structured input before calling the generic generator.

## Initial country-story export

Export the Spanish Wikipedia lead for each qualified team to a CSV for manual import:

```bash
node scripts/export-country-stories.mjs
```

It generates `generated/country-stories-import.csv` with:

- `slug`
- `name`
- `story`

### Import stories into Supabase

1. Run `node scripts/export-country-stories.mjs`.
2. Open `generated/country-stories-import.csv`.
3. Match by `slug` or `name` against `public.country`.
4. Import or merge only the `story` values.
5. If the script flags teams for manual review, leave them blank until you have a verified source.

## Notes

- `SUPABASE_COUNTRY_IMPORT_KEY` in `.env.local` is only used for `node scripts/import-qualified-countries.mjs --write`.
- Do not commit real keys or service-role keys to the repo.
- `--skip-emblems` skips emblem discovery.
- `--shallow-emblems` skips the slower infobox fallback.

> Manual CSV import does not perform the same merge/update behavior as direct-write mode. Use it on an empty table or review existing data carefully before importing.
