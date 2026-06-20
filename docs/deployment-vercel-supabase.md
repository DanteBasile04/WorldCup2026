# Vercel + Supabase deployment

This app should now deploy to Vercel through an explicit pnpm production path.

## Quick path

1. Import the repo into Vercel.
2. Keep the project on the default Next.js framework preset.
3. Set these Environment Variables in Vercel:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
4. Deploy.

The repo pins the production path with `vercel.json` and `package.json`:

- Install command: `pnpm install --frozen-lockfile`
- Build command: `pnpm build`
- Node version: `22.x`

## Environment boundary

| Variable | Where it belongs | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Local `.env.local` and Vercel Project Settings | Required by the Next.js app at runtime. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Local `.env.local` and Vercel Project Settings | Required by the Next.js app at runtime. Safe for the browser. |
| `SUPABASE_COUNTRY_IMPORT_KEY` | Local `.env.local` only | Private write key for local maintenance/import scripts. Not required by Vercel runtime. |
| `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Local-only, only if a script specifically needs an alternate alias | Optional script fallbacks. Do not add them to the current Vercel app unless the deploy architecture changes. |

## Why pnpm is pinned for deploy

Local development is currently allowed to use Bun, but production deploy should stay on pnpm.

That split is intentional:

- Bun remains the preferred local app workflow.
- pnpm remains the explicit Vercel install/build path.
- `vercel.json` removes package-manager auto-detection ambiguity when `bun.lock` and `pnpm-lock.yaml` coexist.

## Local verification path

Use the same build path Vercel now uses:

```bash
pnpm install --frozen-lockfile
pnpm build
```

## Out of scope

This deploy setup does **not** provision private write secrets in Vercel because the current app runtime is public read-only.

If you later add server mutations, cron jobs, or Edge Functions that must write to Supabase, revisit the environment model before adding any write-capable key to Vercel.
