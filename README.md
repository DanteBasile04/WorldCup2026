# World Cup 2026

Aplicación en Next.js (App Router) conectada a Supabase con datos públicos de solo lectura.

## Inicio rápido

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Configurá estas variables en `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xenpsrdxdozzlszaktwa.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=tu_publishable_key
```

## Verificación

```bash
pnpm lint
pnpm build
```

## Importación inicial de selecciones

Generate a CSV with the qualified teams so it can be imported manually into `public.country` in Supabase:

```bash
pnpm import:countries -- --dry-run
pnpm import:countries
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

1. Run `pnpm import:countries`.
2. Open Supabase Dashboard → **Table Editor** → `country`.
3. Choose **Insert** → **Import data from CSV**.
4. Upload `generated/countries-import.csv`.
5. Confirm the mapping for `name`, `federation`, `flag_url`, `flag_storage_path`, `emblem_url`, and `emblem_storage_path`.
6. Let Supabase generate `slug` automatically.

If some rows were imported before this change and are still missing `flag_storage_path` or `emblem_storage_path`, the smallest safe backfill is to run:

```bash
pnpm import:countries:write
```

That direct-write mode now fills the storage-path columns using the same `flags/<slug>.svg` and `emblems/<slug>.svg` convention the app already resolves first, without requiring `--overwrite-media`.

If you want the script to write directly into Supabase:

```bash
pnpm import:countries:write
```

That mode still reads the 2026 qualified teams from Wikipedia, uses Wikimedia URLs for flags, and resolves likely emblems from team pages. By default it preserves already loaded data; use `--overwrite-media` only when you intentionally want to replace media values.

## Formation generator and upload

The formation pipeline now persists two artifacts for each team:

- `public.country.formation` stores the published inline SVG used by the current app read path.
- `public.country.formation_json` stores the structured formation document for future UI rendering and queries.

See [`docs/formation-persistence.md`](docs/formation-persistence.md) for the migration, storage contract, and batch upload commands.

## Shirt-number import

See [`docs/shirt-number-import.md`](docs/shirt-number-import.md) for the migration, prerequisites, dry-run flow, and real import command.

### Ejemplo base

```bash
pnpm formation:svg
pnpm formation:country-update
```

Esto lee `samples/formation-mexico-input.json` y genera:

- `generated/formation-mexico-example.json`
- `generated/formation-mexico-example.svg`

El flujo `formation:country-update` lee `samples/country-formation-mexico-input.json` y genera:

- `generated/mexico-formation-update.json`
- `generated/mexico-formation-update.svg`
- `generated/mexico-formation-update.sql`

Usalo cuando tu contrato sea:

**país + formación + jugadores -> artefacto listo para Supabase**

```bash
pnpm formation:country-update
```

También podés apuntar a otro JSON y cambiar la carpeta de salida:

```bash
node scripts/generate-country-formation-update.mjs \
  --input samples/country-formation-mexico-input.json \
  --output-dir generated/custom
```

### Local preview before export

If you want to inspect the formation before exporting or writing it to the database:

```bash
pnpm formation:preview --input samples/country-formation-mexico-input.json --open
```

That generates a local HTML page and opens it in the browser.

It also accepts text authoring input:

```bash
pnpm formation:preview --text "mexico 4-3-3
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

pnpm formation:preview --slug mexico --formation 4-3-3 --players "1,Guillermo Ochoa,GK,Ochoa,GK;2,Julian Araujo,DF,Araujo,RB;3,Cesar Montes,DF,Montes,RCB;4,Johan Vazquez,DF,Vazquez,LCB;5,Jesus Gallardo,DF,Gallardo,LB;6,Edson Alvarez,MF,Alvarez,DM;7,Luis Chavez,MF,Chavez,LCM;8,Hector Herrera,MF,Herrera,RCM;9,Santiago Gimenez,FW,Gimenez,ST;10,Alexis Vega,FW,Vega,LW;11,Hirving Lozano,FW,Lozano,RW" --open
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

### Compatibilidad con PDF / match summary

El flujo viejo de FIFA Match Summary sigue existiendo como adaptador opcional:

```bash
pnpm extract:match-summary:formation
pnpm extract:match-summary:formation -- --lineup-file path/to/formation.txt
```

Ese wrapper transforma el texto al mismo input estructurado antes de llamar al generador genérico.

## Exportación inicial de historias de selecciones

Exporta el lead de Wikipedia en español de cada selección clasificada a un CSV para importación manual:

```bash
pnpm import:country-stories
```

Genera `generated/country-stories-import.csv` con:

- `slug`
- `name`
- `story`

### Importar historias en Supabase

1. Ejecutá `pnpm import:country-stories`.
2. Abrí `generated/country-stories-import.csv`.
3. Matcheá por `slug` o `name` con `public.country`.
4. Importá o mergeá solo los valores de `story`.
5. Si el script marca selecciones para revisión manual, dejalas vacías hasta conseguir la fuente.

## Notas

- `SUPABASE_COUNTRY_IMPORT_KEY` en `.env.local` se usa solo para `pnpm import:countries:write`.
- No subas claves reales ni service-role keys al repo.
- `--skip-emblems` evita la búsqueda de escudos.
- `--shallow-emblems` evita el fallback más lento por infobox.

> La importación manual por CSV no hace el mismo merge/update que el modo direct-write. Usala sobre una tabla vacía o controlá bien los datos existentes antes de importar.
