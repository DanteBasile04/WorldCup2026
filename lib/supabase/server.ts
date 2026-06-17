import { createClient } from "@supabase/supabase-js";

import type { Database } from "./database.types";

type SupabaseConfig =
  | { ok: true; url: string; publishableKey: string }
  | { ok: false; missing: string[] };

export function getSupabaseConfig(): SupabaseConfig {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const missing: string[] = [];

  if (!url) {
    missing.push("NEXT_PUBLIC_SUPABASE_URL");
  }

  if (!publishableKey) {
    missing.push("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  }

  if (missing.length > 0 || !url || !publishableKey) {
    return { ok: false, missing };
  }

  return { ok: true, url, publishableKey };
}

export function createSupabaseServerClient() {
  const config = getSupabaseConfig();

  if (!config.ok) {
    throw new Error(`Missing Supabase environment: ${config.missing.join(", ")}`);
  }

  return createClient<Database>(config.url, config.publishableKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
    global: {
      headers: {
        "X-Client-Info": "wc26-nextjs-public-read",
      },
    },
  });
}
