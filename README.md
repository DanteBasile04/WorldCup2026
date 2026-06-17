# World Cup 2026

Next.js App Router app backed by Supabase public read-only data.

## Setup

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Set the Supabase publishable key in `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xenpsrdxdozzlszaktwa.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

## Verification

```bash
pnpm lint
pnpm build
```

## One-time country import

Export the currently qualified 2026 World Cup teams to a CSV that can be imported manually into
`public.country` from the Supabase dashboard:

```bash
pnpm import:countries -- --dry-run
pnpm import:countries
```

This generates `generated/countries-import.csv` with the columns `name`, `federation`,
`flag_url`, and `emblem_url`. It intentionally omits `slug` so the database default can generate
it, and it does not include optional enrichment fields such as `colors`, `story`, `trophies`, or
`formation`.

### Import into Supabase

1. Run `pnpm import:countries`.
2. Open Supabase Dashboard → **Table Editor** → `country`.
3. Click **Insert** → **Import data from CSV**.
4. Upload `generated/countries-import.csv`.
5. Confirm the CSV maps only `name`, `federation`, `flag_url`, and `emblem_url`.
6. Complete the import and let Supabase generate `slug` automatically.

If you still want the script to write directly to Supabase, use:

```bash
pnpm import:countries:write
```

Direct-write mode still reads the qualified teams table from the 2026 FIFA World Cup Wikipedia
page, uses Wikimedia upload URLs for flags, resolves likely team emblems from national-team page
images only when the filename looks like a crest/logo, then inserts missing rows or fills empty
`federation`, `flag_url`, and `emblem_url` fields. Existing populated import fields are preserved
by default; pass `--overwrite-media` if you intentionally want to replace them.

## Formation SVG generator

The primary contract is now **structured input JSON -> reusable layout -> compact inline SVG string**.
That SVG is intended to be stored directly in `public.country.formation` in Supabase.
The renderer keeps the output clean: pitch only, player marker, shirt number, and player label below the marker.

Generate the Mexico example fixture:

```bash
pnpm formation:svg
pnpm formation:country-update
```

This reads `samples/formation-mexico-input.json` and writes:

- `generated/formation-mexico-example.json` — normalized formation document with assigned pitch coordinates
- `generated/formation-mexico-example.svg` — compact inline SVG ready to persist as text

The country-update flow reads `samples/country-formation-mexico-input.json` and writes:

- `generated/mexico-formation-update.json` — payload with `country`, normalized formation `document`, inline `formationSvg`, and ready-to-run `sql`
- `generated/mexico-formation-update.svg` — compact inline SVG ready to persist as text
- `generated/mexico-formation-update.sql` — escaped SQL statement ready to update `public.country.formation`

Use this when your main contract is **country slug/name + formation + players -> Supabase-ready update artifact**:

```bash
pnpm formation:country-update
```

You can point it at any structured input JSON and override outputs if needed:

```bash
node scripts/generate-country-formation-update.mjs \
  --input samples/country-formation-mexico-input.json \
  --output-dir generated/custom
```

Input shape example:

```json
{
  "country": { "slug": "mexico", "name": "Mexico" },
  "team": { "name": "Mexico", "formation": "4-1-2-3" },
  "players": [
    { "number": 1, "name": "Raul RANGEL", "role": "GK", "slot": "GK" }
  ]
}
```

- `country.slug` is preferred for SQL targeting
- `country.name` is used as a fallback when no slug is provided
- the PDF / match-summary parser remains an optional adapter that can still emit this structured input shape

You can also use the generator with any other structured source:

```bash
node scripts/generate-formation-svg.mjs --input samples/formation-mexico-input.json
```

If you omit `--svg-output`, the script prints the SVG string to stdout. Optional outputs:

```bash
node scripts/generate-formation-svg.mjs \
  --input samples/formation-mexico-input.json \
  --json-output generated/formation-output.json \
  --svg-output generated/formation-output.svg
```

### Input shape

```json
{
  "team": { "name": "Mexico", "formation": "4-1-2-3" },
  "players": [
    { "number": 1, "name": "Raul RANGEL", "role": "GK", "slot": "GK" }
  ]
}
```

- `team.name` and `team.formation` are required
- `players` is required
- `slot` is optional when players can be assigned by role order, but explicit slots are preferred for stable output

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

Unsupported formations fail fast with a clear error that lists the available layout keys.

### PDF / match summary compatibility

The old FIFA Match Summary flow remains only as an **optional source adapter**:

```bash
pnpm extract:match-summary:formation
pnpm extract:match-summary:formation -- --lineup-file path/to/formation.txt
```

That wrapper converts match-summary text into the same structured formation input before calling the
generic SVG generator. In other words, the PDF is just one possible source, not the main contract.

## One-time country story export

Export the Spanish Wikipedia lead text for each qualified national team to a CSV for manual story
import:

```bash
pnpm import:country-stories
```

This generates `generated/country-stories-import.csv` with `slug`, `name`, and `story`. The
script reuses the qualified-team discovery from the countries importer, resolves each national-team
article on Spanish Wikipedia when available, and exports only the introductory lead text as plain
text.

### Import stories into Supabase

1. Run `pnpm import:country-stories`.
2. Open `generated/country-stories-import.csv` and use `slug` or `name` to match the existing
   `public.country` rows.
3. Import or merge only the `story` values into `public.country.story`.
4. If the script reports manual follow-up teams, leave those stories blank until you source them
   yourself.

Use `SUPABASE_COUNTRY_IMPORT_KEY` in `.env.local` only for `pnpm import:countries:write` if writes
require a server-side key. Do not commit real secret or service-role keys. Use `--skip-emblems` to
avoid emblem lookup or `--shallow-emblems` to skip the slower infobox fallback.

> Manual CSV import does not perform the same read/merge/update logic as direct-write mode. Use it
> on an empty `country` table, or clear/import carefully if rows already exist.
