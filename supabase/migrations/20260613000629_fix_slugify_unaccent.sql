create extension if not exists unaccent with schema extensions;

create or replace function private.slugify(input text)
returns text
language sql
immutable
set search_path to 'pg_catalog', 'extensions'
as $function$
  select nullif(
    trim(
      both '-'
      from regexp_replace(
        lower(extensions.unaccent(coalesce(input, ''))),
        '[^a-z0-9]+',
        '-',
        'g'
      )
    ),
    ''
  );
$function$;
