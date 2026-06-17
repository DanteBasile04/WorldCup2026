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

Genera un CSV con las selecciones clasificadas para importarlo manualmente en `public.country` desde Supabase:

```bash
pnpm import:countries -- --dry-run
pnpm import:countries
```

Se genera `generated/countries-import.csv` con estas columnas:

- `name`
- `federation`
- `flag_url`
- `emblem_url`

No incluye `slug` porque lo genera la base de datos, ni campos opcionales como `colors`, `story`, `trophies` o `formation`.

### Importar en Supabase

1. Ejecutá `pnpm import:countries`.
2. Abrí Supabase Dashboard → **Table Editor** → `country`.
3. Elegí **Insert** → **Import data from CSV**.
4. Subí `generated/countries-import.csv`.
5. Confirmá el mapeo solo para `name`, `federation`, `flag_url` y `emblem_url`.
6. Dejá que Supabase genere `slug` automáticamente.

Si querés que el script escriba directo en Supabase:

```bash
pnpm import:countries:write
```

Ese modo sigue leyendo la tabla de clasificados desde Wikipedia 2026, usa URLs de Wikimedia para banderas y resuelve escudos probables desde páginas de selecciones. Por defecto preserva datos ya cargados; usá `--overwrite-media` solo si querés reemplazarlos a propósito.

## Generador de formaciones SVG

El contrato principal es:

**JSON estructurado -> layout reutilizable -> SVG inline compacto**

Ese SVG está pensado para guardarse directamente en `public.country.formation` dentro de Supabase.

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

### Preview local antes de exportar

Si querés revisar visualmente la formación antes de exportarla o escribirla en la base:

```bash
pnpm formation:preview --input samples/country-formation-mexico-input.json --open
```

Eso genera una página HTML local y la abre en el navegador.

También admite otros formatos:

```bash
pnpm formation:preview --text "mexico 4-3-3
1 Ochoa GK
2 Araujo DF
3 Montes DF
4 Vasquez DF
5 Gallardo DF
6 Alvarez MF
7 Chavez MF
8 Herrera MF
9 Gimenez FW
10 Vega FW
11 Lozano FW" --open

pnpm formation:preview --slug mexico --formation 4-3-3 --players "1,Ochoa,GK;2,Araujo,DF;3,Montes,DF;4,Vasquez,DF;5,Gallardo,DF;6,Alvarez,MF;7,Chavez,MF;8,Herrera,MF;9,Gimenez,FW;10,Vega,FW;11,Lozano,FW" --open
```

Flags útiles:

- `--open` → abre el preview en el navegador
- `--output <path>` → guarda el HTML en otra ruta
- `--stdout` → imprime el HTML
- `--stdin` → lee input compacto desde stdin

Por defecto se escribe en `generated/preview-formation.html`.

### Estructura del input

```json
{
  "country": { "slug": "mexico", "name": "Mexico" },
  "team": { "name": "Mexico", "formation": "4-1-2-3" },
  "players": [
    { "number": 1, "name": "Raul RANGEL", "role": "GK", "slot": "GK" }
  ]
}
```

Reglas:

- `country.slug` es la mejor opción para generar SQL
- `country.name` queda como fallback
- `team.name` y `team.formation` son obligatorios
- `players` es obligatorio
- `slot` es opcional, pero recomendado para mantener estabilidad en el layout

### Layouts soportados

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

Si la formación no está soportada, el script falla con un error claro mostrando las opciones válidas.

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
