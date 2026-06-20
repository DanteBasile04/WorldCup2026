#!/usr/bin/env node

/**
 * Local formation upload tool — private CLI for authoring team formations.
 *
 * Accepts JSON or text authoring input and writes both formation artifacts:
 *   - country.formation: published inline SVG
 *   - country.formation_json: structured formation document for future UI rendering
 *
 * Requires a Supabase write-capable key in --write mode.
 *
 * THIS IS A PRIVATE LOCAL TOOL. Do not expose as a public route, server
 * action, or visible UI component.
 *
 * Input formats:
 *
 *   1. JSON file (like samples/country-formation-mexico-input.json):
 *      node scripts/upload-formation.mjs --input samples/country-formation-mexico-input.json
 *
 *   2. Text authoring format (stdin or --text):
 *      echo "argentina 4-3-3
 *            1 Martinez GK
 *            4 | Gonzalo Montiel | DF | Montiel | LB
 *            ..." | node scripts/upload-formation.mjs --stdin
 *
 *      node scripts/upload-formation.mjs --text "argentina 4-3-3
 *            1 Martinez GK
 *            4 | Gonzalo Montiel | DF | Montiel | LB
 *            ..."
 *
 *   3. Command-line arguments:
 *      node scripts/upload-formation.mjs --slug argentina --formation "4-3-3" --players "1,Martinez,GK;4,Gonzalo Montiel,DF,Montiel,LB;..."
 *
 * Output:
 *   --dry-run (default): Validates input, generates SVG, prints SQL — does NOT write to DB.
 *   --write:              Uploads both formation SVG and formation JSON via Supabase.
 *   --sql-only:           Prints the SQL UPDATE statement without executing.
 *
 * Environment variables (for --write mode):
 *   NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL
 *   SUPABASE_COUNTRY_IMPORT_KEY, SUPABASE_SECRET_KEY, or SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseFormationAuthoringText, parseFormationPlayersArgument } from "./lib/formation-authoring.mjs";
import { createCountryFormationUpdate } from "./lib/formation-svg.mjs";

const argv = process.argv.slice(2);

// ---------------------------------------------------------------------------
// Parse CLI options
// ---------------------------------------------------------------------------

function getOptionValue(args, optionName) {
  const directMatch = args.find((value) => value.startsWith(`${optionName}=`));
  if (directMatch) return directMatch.slice(optionName.length + 1).trim();

  const index = args.indexOf(optionName);
  if (index === -1) return null;

  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value for ${optionName}.`);
  }

  return value;
}

const args = new Set(argv);
const writeMode = args.has("--write");
const sqlOnly = args.has("--sql-only");
const stdinMode = args.has("--stdin");
const inputPath = getOptionValue(argv, "--input");
const textInput = getOptionValue(argv, "--text");
const slugArg = getOptionValue(argv, "--slug");
const formationArg = getOptionValue(argv, "--formation");
const playersArg = getOptionValue(argv, "--players");

if (writeMode && sqlOnly) {
  console.error("Choose either --write or --sql-only, not both.");
  process.exit(1);
}

loadEnvFile(".env.local");
loadEnvFile(".env");

try {
  const formationInput = resolveFormationInput();
  const payload = createCountryFormationUpdate(formationInput);

  console.log(`\nFormation: ${payload.document.team.formation}`);
  console.log(`Country: ${payload.country.slug ?? payload.country.name}`);
  console.log(`Players: ${payload.document.players.length}`);
  console.log(`SVG length: ${payload.formationSvg.length} chars`);

  if (sqlOnly) {
    console.log(`\n${payload.sql}`);
  } else if (writeMode) {
    await uploadFormation(payload);
} else {
    // Default: dry-run — validate and preview without writing
    console.log("\n[DRY RUN] No changes written. Use --write to upload or --sql-only to print SQL.");
    console.log(`\nSQL preview:\n${payload.sql}`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Input resolution
// ---------------------------------------------------------------------------

function resolveFormationInput() {
  // Priority 1: JSON file input
  if (inputPath) {
    const resolvedPath = resolve(process.cwd(), inputPath);
    if (!existsSync(resolvedPath)) {
      throw new Error(`Input file not found: ${resolvedPath}`);
    }
    const raw = readFileSync(resolvedPath, "utf8");
    return JSON.parse(raw);
  }

  // Priority 2: --text authoring format
  if (textInput) {
    return parseCompactText(textInput);
  }

  // Priority 3: --slug + --formation + --players
  if (slugArg && formationArg && playersArg) {
    return parseCliArgs(slugArg, formationArg, playersArg);
  }

  // Priority 4: stdin
  if (stdinMode) {
    return readStdinSync();
  }

  throw new Error(
    "No input provided. Use --input <file.json>, --text <authoring-text>, --slug/--formation/--players, or --stdin.",
  );
}

/**
 * Parse text authoring format.
 */
function parseCompactText(text) {
  return parseFormationAuthoringText(text);
}

/**
 * Parse CLI arguments: --slug, --formation, --players
 * Players format: "1,Martinez,GK;4,Gonzalo Montiel,DF,Montiel,LB;..."
 */
function parseCliArgs(slug, formation, playersStr) {
  const players = parseFormationPlayersArgument(playersStr);

  return {
    country: { slug },
    team: { formation },
    players,
  };
}

/**
 * Read stdin synchronously (for piped input).
 */
function readStdinSync() {
  // In Node.js, reading stdin synchronously requires fs.readFileSync on fd 0,
  // which only works when stdin is a pipe (not a TTY).
  // Fall back to a user-friendly error if running interactively.
  try {
    const buffer = readFileSync(0, "utf8");
    return parseCompactText(buffer);
  } catch {
    throw new Error(
      "Could not read from stdin. Use --input <file> or --text <authoring-text> instead.",
    );
  }
}

// ---------------------------------------------------------------------------
// Upload logic
// ---------------------------------------------------------------------------

async function uploadFormation(payload) {
  const whereKey = payload.country.slug
    ? { column: "slug", value: payload.country.slug }
    : { column: "name", value: payload.country.name };

  if (!whereKey.value) {
    throw new Error("Country identification required: provide slug or name.");
  }

  const supabase = createSupabaseClient();

  // Verify the country exists before updating
  const { data: country, error: readError } = await supabase
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

  // Confirm overwrite if formation already exists
  if (country.formation) {
    console.log(`\n⚠ Country "${country.name}" (slug: ${country.slug}) already has a formation value.`);
    console.log("  Continuing will overwrite it.\n");
  }

  const updateData = { formation: payload.formationSvg };
  if (payload.formationJson != null) {
    updateData.formation_json = payload.formationJson;
  }

  const { error: updateError } = await supabase
    .from("country")
    .update(updateData)
    .eq("id", country.id);

  if (updateError) {
    throw new Error(`Failed to update country: ${updateError.message}`);
  }

  console.log(`\n✓ Updated formation assets for ${country.name} (slug: ${country.slug}).`);
  console.log(`  Formation: ${payload.document.team.formation}`);
  console.log(`  Players: ${payload.document.players.length}`);
  console.log(`  SVG: ${payload.formationSvg.length} chars written to country.formation`);
  console.log(`  JSON: ${JSON.stringify(payload.formationJson).length} chars written to country.formation_json`);
}

// ---------------------------------------------------------------------------
// Environment & Supabase helpers
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

function createSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  // Write operations must prefer the private key over the publishable (anon) key.
  // The publishable key lacks INSERT/UPDATE permissions on country.formation,
  // so it must not shadow the import key when both are present in .env.local.
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
        "X-Client-Info": "wc26-formation-upload",
      },
    },
  });
}
