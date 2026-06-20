# Player shirt-number import

This is the smallest safe path to move validated shirt-number matches from the local CSV export into `public.player.shirt_number`.

## Quick path

1. Apply `supabase/migrations/20260619_add_player_shirt_number.sql` to the target Supabase database.
2. Ensure the CSV exists at `generated/match-summary-ingest/shirt-number-updates/shirt-numbers.csv` or pass `--input <path>`.
3. Dry-run the importer: `node scripts/import-player-shirt-numbers.mjs`
4. Real import after review: `node scripts/import-player-shirt-numbers.mjs --write`

## Prerequisites

| Requirement | Why it matters |
|---|---|
| `public.player.shirt_number integer null` exists | The importer updates this column directly by `player.id`. |
| `NEXT_PUBLIC_SUPABASE_URL` or `SUPABASE_URL` | Required to connect to Supabase in `--write` mode. |
| `SUPABASE_COUNTRY_IMPORT_KEY`, `SUPABASE_SECRET_KEY`, or `SUPABASE_SERVICE_ROLE_KEY` | A private write-capable key is required. The importer does not use the publishable key for writes. |

## Safety contract

- Dry-run is the default.
- Only positive integer `player_id` and `shirt_number` values are importable.
- Malformed rows are skipped and reported.
- Duplicate rows with the same value are skipped and reported.
- Conflicting rows for the same `player_id` are excluded from import and reported.
- Existing valid DB values are left unchanged when the incoming value is identical.

## Commands

```bash
# Default input path, dry-run only
node scripts/import-player-shirt-numbers.mjs

# Real write to Supabase after the migration is applied
node scripts/import-player-shirt-numbers.mjs --write

# Alternate CSV path
node scripts/import-player-shirt-numbers.mjs --input generated/custom/shirt-numbers.csv
```
