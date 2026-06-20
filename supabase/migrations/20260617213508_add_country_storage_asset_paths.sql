alter table public.country
add column if not exists flag_storage_path text,
add column if not exists flag_banner_storage_path text,
add column if not exists emblem_storage_path text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.country'::regclass
      and conname = 'country_flag_storage_path_not_blank'
  ) then
    alter table public.country
    add constraint country_flag_storage_path_not_blank
    check (flag_storage_path is null or btrim(flag_storage_path) <> '');
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.country'::regclass
      and conname = 'country_flag_banner_storage_path_not_blank'
  ) then
    alter table public.country
    add constraint country_flag_banner_storage_path_not_blank
    check (flag_banner_storage_path is null or btrim(flag_banner_storage_path) <> '');
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.country'::regclass
      and conname = 'country_emblem_storage_path_not_blank'
  ) then
    alter table public.country
    add constraint country_emblem_storage_path_not_blank
    check (emblem_storage_path is null or btrim(emblem_storage_path) <> '');
  end if;
end
$$;

comment on column public.country.flag_storage_path is 'Supabase Storage path for the primary flag asset, e.g. flags/argentina.svg';
comment on column public.country.flag_banner_storage_path is 'Supabase Storage path for the banner/background flag asset, e.g. flags/banner/argentina.svg';
comment on column public.country.emblem_storage_path is 'Supabase Storage path for the national team emblem asset, e.g. emblems/argentina.svg';
