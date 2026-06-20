alter table public.country
add column if not exists formation_json jsonb;
