// ---------------------------------------------------------------------------
// Storage-first asset URL resolver — builds public Supabase Storage URLs
// from DB storage paths when present, otherwise falls back to external URLs.
//
// This enables gradual migration from external media (Wikimedia, etc.) to
// internally hosted Supabase Storage assets without changing every component.
//
// Bucket convention: country-media
// Inference: flag_storage_path  → flags/argentina.svg
//            flag_banner_storage_path → flags/banner/argentina.svg
//            emblem_storage_path → emblems/argentina.svg
// ---------------------------------------------------------------------------

import { getSupabaseConfig } from "./server";

/** Default Storage bucket for country media assets. */
const COUNTRY_MEDIA_BUCKET = "country-media";

/**
 * Build a public Supabase Storage URL for a given bucket and path.
 * Returns null if the path is falsy or if Supabase config is unavailable.
 */
function storageUrl(bucket: string, path: string): string | null {
  if (!path || !path.trim()) return null;

  const config = getSupabaseConfig();
  if (!config.ok) return null;

  // Strip a leading slash if present — Storage paths are bucket-relative.
  const cleanPath = path.startsWith("/") ? path.slice(1) : path;
  return `${config.url}/storage/v1/object/public/${bucket}/${cleanPath}`;
}

/**
 * Resolve a regular flag asset URL.
 * Prefers internal Storage (`flag_storage_path`), falls back to external `flag_url`.
 */
export function resolveFlagUrl(
  flagStoragePath: string | null,
  flagUrl: string | null,
): string | null {
  return storageUrl(COUNTRY_MEDIA_BUCKET, flagStoragePath ?? "") ?? flagUrl;
}

/**
 * Resolve a hero/banner background asset URL.
 * Prefers `flag_banner_storage_path`, then `flag_storage_path`, then external `flag_url`.
 * The banner variant is typically wider and better suited for hero backgrounds.
 */
export function resolveHeroBackgroundUrl(
  flagBannerStoragePath: string | null,
  flagStoragePath: string | null,
  flagUrl: string | null,
): string | null {
  return (
    storageUrl(COUNTRY_MEDIA_BUCKET, flagBannerStoragePath ?? "")
      ?? storageUrl(COUNTRY_MEDIA_BUCKET, flagStoragePath ?? "")
      ?? flagUrl
  );
}

/**
 * Resolve a team crest/emblem asset URL.
 * Prefers internal Storage (`emblem_storage_path`), falls back to external `emblem_url`.
 */
export function resolveEmblemUrl(
  emblemStoragePath: string | null,
  emblemUrl: string | null,
): string | null {
  return storageUrl(COUNTRY_MEDIA_BUCKET, emblemStoragePath ?? "") ?? emblemUrl;
}

// -- Site-level assets -------------------------------------------------------

/** Storage path for the site-wide hero banner inside the country-media bucket. */
export const SITE_HERO_BANNER_PATH = "site/hero/main-banner.webp";

/**
 * Resolve the site-wide hero banner URL.
 * Returns the public Supabase Storage URL for the dedicated banner asset,
 * or null if Supabase config is unavailable.
 *
 * Graceful degradation: the caller should fall back to a decorative
 * alternative (e.g. flag mosaic) when this returns null.
 */
export function resolveSiteHeroUrl(): string | null {
  return storageUrl(COUNTRY_MEDIA_BUCKET, SITE_HERO_BANNER_PATH);
}