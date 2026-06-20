#!/usr/bin/env node

/**
 * Batch formation uploader — uploads all canonical formation inputs to Supabase.
 *
 * Discovers every samples/teams/<team>/country-formation-input.json file, generates
 * both the published SVG and the structured formation document for each, and
 * either writes them to Supabase or validates them in dry-run mode.
 *
 * Usage:
 *   node scripts/batch-upload-formations.mjs              # dry-run (default)
 *   node scripts/batch-upload-formations.mjs --write      # actually write to DB
 *
 * Environment variables (for --write mode):
 *   NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL
 *   SUPABASE_COUNTRY_IMPORT_KEY, SUPABASE_SECRET_KEY, or SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createCountryFormationUpdate } from "./lib/formation-svg.mjs";

// ---------------------------------------------------------------------------
// CLI parsing
// ---------------------------------------------------------------------------

const argv = process.argv.slice(2);
const args = new Set(argv);
const writeMode = args.has("--write");

loadEnvFile(".env.local");
loadEnvFile(".env");

// ---------------------------------------------------------------------------
// Discover formation input files
// ---------------------------------------------------------------------------

const TEAMS_DIR = resolve(process.cwd(), "samples/teams");

function discoverFormationInputs() {
  if (!existsSync(TEAMS_DIR)) {
    console.error(`Teams directory not found: ${TEAMS_DIR}`);
    process.exit(1);
  }

  const teamDirs = readdirSync(TEAMS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  const inputs = [];

  for (const teamDir of teamDirs) {
    const inputPath = resolve(TEAMS_DIR, teamDir, "country-formation-input.json");
    if (!existsSync(inputPath)) continue;

    try {
      const raw = readFileSync(inputPath, "utf8");
      const parsed = JSON.parse(raw);
      inputs.push({ teamDir, inputPath, data: parsed });
    } catch (err) {
      console.error(`  ⚠ Failed to parse ${inputPath}: ${err.message}`);
    }
  }

  return inputs;
}

// ---------------------------------------------------------------------------
// Generate payloads
// ---------------------------------------------------------------------------

function generatePayloads(inputs) {
  const results = [];

  for (const { teamDir, inputPath, data } of inputs) {
    try {
      const payload = createCountryFormationUpdate(data);
      results.push({ teamDir, inputPath, payload, error: null });
    } catch (err) {
      results.push({ teamDir, inputPath, payload: null, error: err.message });
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Upload to Supabase
// ---------------------------------------------------------------------------

function createSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  // Write operations must prefer the private key over the publishable (anon) key.
  const key =
    process.env.SUPABASE_COUNTRY_IMPORT_KEY ??
    process.env.SUPABASE_SECRET_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL.");
  }

  if (!key) {
    throw new Error(
      "Missing Supabase write key. Set SUPABASE_COUNTRY_IMPORT_KEY, SUPABASE_SECRET_KEY, or SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
    global: {
      headers: {
        "X-Client-Info": "wc26-batch-formation-upload",
      },
    },
  });
}

async function uploadPayload(client, payload) {
  const whereKey = payload.country.slug
    ? { column: "slug", value: payload.country.slug }
    : { column: "name", value: payload.country.name };

  if (!whereKey.value) {
    throw new Error("Country identification required: provide slug or name.");
  }

  // Verify the country exists before updating
  const { data: country, error: readError } = await client
    .from("country")
    .select("id, name, slug, formation, formation_json")
    .eq(whereKey.column, whereKey.value)
    .maybeSingle();

  if (readError) {
    throw new Error(`Could not look up country: ${readError.message}`);
  }

  if (!country) {
    throw new Error(`Country not found: ${whereKey.column} = ${whereKey.value}`);
  }

  const updateData = { formation: payload.formationSvg };
  if (payload.formationJson != null) {
    updateData.formation_json = payload.formationJson;
  }

  const { error: updateError } = await client
    .from("country")
    .update(updateData)
    .eq("id", country.id);

  if (updateError) {
    throw new Error(`Failed to update country: ${updateError.message}`);
  }

  return country;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const inputs = discoverFormationInputs();

console.log(`\nDiscovered ${inputs.length} canonical formation input(s).`);

if (inputs.length === 0) {
  console.error("No formation inputs found. Check samples/teams/*/country-formation-input.json");
  process.exit(1);
}

const results = generatePayloads(inputs);

const valid = results.filter((r) => !r.error);
const failed = results.filter((r) => r.error);

// Report generation errors
for (const { teamDir, error } of failed) {
  console.error(`  ✗ ${teamDir}: ${error}`);
}

console.log(`\nGenerated ${valid.length} formation payload(s), ${failed.length} failed.`);

if (valid.length === 0) {
  console.error("No valid formations to process.");
  process.exit(1);
}

// Summary table (dry-run or pre-write)
for (const { teamDir, payload } of valid) {
  const slug = payload.country.slug ?? payload.country.name ?? teamDir;
  console.log(`  ${slug.padEnd(20)} ${payload.document.team.formation}   ${payload.document.players.length} players   ${payload.formationSvg.length} chars SVG   ${JSON.stringify(payload.formationJson).length} chars JSON`);
}

if (!writeMode) {
  console.log("\n[DRY RUN] No changes written. Use --write to upload all formations.");
  process.exit(0);
}

// --write mode: upload to Supabase
console.log("\n⏳ Uploading formations to Supabase...\n");

const client = createSupabaseClient();
let uploaded = 0;
let errors = 0;

for (const { teamDir, payload } of valid) {
  const slug = payload.country.slug ?? payload.country.name ?? teamDir;
  try {
    const country = await uploadPayload(client, payload);
    console.log(`  ✓ ${country.name} (${country.slug}) — formation updated`);
    uploaded++;
  } catch (err) {
    console.error(`  ✗ ${slug}: ${err.message}`);
    errors++;
  }
}

console.log(`\nDone. ${uploaded} uploaded, ${errors} errors, ${failed.length} skipped (generation failed).`);

if (errors > 0) process.exit(1);

// ---------------------------------------------------------------------------
// Environment helper (duplicated from upload-formation.mjs for autonomy)
// ---------------------------------------------------------------------------

function loadEnvFile(fileName) {
  const path = resolve(process.cwd(), fileName);
  if (!existsSync(path)) return;

  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;

    const key = trimmed.slice(0, separator).trim();
    const rawValue = trimmed.slice(separator + 1).trim();

    if (!key || process.env[key]) continue;

    process.env[key] = rawValue.replace(/^['"]|['"]$/g, "");
  }
}
