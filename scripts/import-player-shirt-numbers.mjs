#!/usr/bin/env node

import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getOptionValue } from "./lib/qualified-countries.mjs";

const DEFAULT_INPUT_PATH = "generated/match-summary-ingest/shirt-number-updates/shirt-numbers.csv";
const EXPECTED_COLUMNS = ["player_id", "shirt_number"];

if (isDirectExecution()) {
  const argv = process.argv.slice(2);

  if (argv.includes("--help") || argv.includes("-h")) {
    printHelp();
    process.exit(0);
  }

  const writeMode = argv.includes("--write");
  const inputPath = resolve(process.cwd(), getOptionValue(argv, "--input") ?? DEFAULT_INPUT_PATH);

  try {
    loadEnvFile(".env.local");
    loadEnvFile(".env");

    const summary = await importPlayerShirtNumbers({ inputPath, writeMode });
    printSummary(summary);

    if (summary.write.failures > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

export async function importPlayerShirtNumbers({ inputPath, writeMode = false }) {
  if (!existsSync(inputPath)) {
    throw new Error(`Input CSV not found: ${inputPath}`);
  }

  const csvText = readFileSync(inputPath, "utf8");
  const parsed = parseImportCsv(csvText, inputPath);

  const summary = {
    mode: writeMode ? "write" : "dry-run",
    input_path: normalizePath(inputPath),
    rows_scanned: parsed.rowsScanned,
    ready_to_import: parsed.acceptedRows.length,
    skipped: {
      malformed: parsed.malformedRows.length,
      duplicate: parsed.duplicateRows.length,
      conflicting: parsed.conflictingRows.length,
    },
    details: {
      malformed_rows: parsed.malformedRows,
      duplicate_rows: parsed.duplicateRows,
      conflicting_rows: parsed.conflictingRows,
    },
    write: {
      attempted: 0,
      updated: 0,
      unchanged: 0,
      missing_players: 0,
      failures: 0,
      failure_details: [],
    },
  };

  if (!writeMode || parsed.acceptedRows.length === 0) {
    return summary;
  }

  const supabase = createSupabaseClient();
  const playerIds = parsed.acceptedRows.map((row) => row.playerId);
  const existingPlayers = await loadExistingPlayers(supabase, playerIds);

  for (const row of parsed.acceptedRows) {
    summary.write.attempted += 1;

    const existing = existingPlayers.get(row.playerId);

    if (!existing) {
      summary.write.missing_players += 1;
      summary.write.failure_details.push({
        line: row.line,
        player_id: row.playerId,
        shirt_number: row.shirtNumber,
        reason: "No player row matched the provided id.",
      });
      continue;
    }

    if (existing.shirt_number === row.shirtNumber) {
      summary.write.unchanged += 1;
      continue;
    }

    const { error } = await supabase
      .from("player")
      .update({ shirt_number: row.shirtNumber })
      .eq("id", row.playerId);

    if (error) {
      summary.write.failures += 1;
      summary.write.failure_details.push({
        line: row.line,
        player_id: row.playerId,
        shirt_number: row.shirtNumber,
        reason: error.message,
      });
      continue;
    }

    summary.write.updated += 1;
  }

  return summary;
}

function parseImportCsv(csvText, inputPath) {
  const lines = String(csvText)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    throw new Error(`Input CSV is empty: ${inputPath}`);
  }

  const header = parseCsvLine(lines[0]);

  if (header.length !== EXPECTED_COLUMNS.length || !EXPECTED_COLUMNS.every((column, index) => header[index] === column)) {
    throw new Error(`Input CSV must start with header ${EXPECTED_COLUMNS.join(",")}. Received: ${lines[0]}`);
  }

  const acceptedRows = new Map();
  const malformedRows = [];
  const duplicateRows = [];
  const conflictingRows = [];
  const conflictingPlayerIds = new Set();

  for (let index = 1; index < lines.length; index += 1) {
    const lineNumber = index + 1;
    const rawLine = lines[index];
    const columns = parseCsvLine(rawLine);

    if (columns.length !== EXPECTED_COLUMNS.length) {
      malformedRows.push({ line: lineNumber, raw: rawLine, reason: "Expected exactly 2 CSV columns." });
      continue;
    }

    const playerId = parsePositiveInteger(columns[0]);
    const shirtNumber = parsePositiveInteger(columns[1]);

    if (!Number.isInteger(playerId) || !Number.isInteger(shirtNumber)) {
      malformedRows.push({ line: lineNumber, raw: rawLine, reason: "player_id and shirt_number must both be positive integers." });
      continue;
    }

    const existing = acceptedRows.get(playerId);

    if (!existing && !conflictingPlayerIds.has(playerId)) {
      acceptedRows.set(playerId, { line: lineNumber, playerId, shirtNumber });
      continue;
    }

    if (existing && existing.shirtNumber === shirtNumber) {
      duplicateRows.push({ line: lineNumber, player_id: playerId, shirt_number: shirtNumber, reason: "Duplicate player_id with the same shirt_number." });
      continue;
    }

    if (existing) {
      conflictingPlayerIds.add(playerId);
      acceptedRows.delete(playerId);
      conflictingRows.push({ line: existing.line, player_id: playerId, shirt_number: existing.shirtNumber, reason: "Conflicting shirt_number for the same player_id." });
    }

    conflictingPlayerIds.add(playerId);
    conflictingRows.push({ line: lineNumber, player_id: playerId, shirt_number: shirtNumber, reason: "Conflicting shirt_number for the same player_id." });
  }

  return {
    rowsScanned: Math.max(lines.length - 1, 0),
    acceptedRows: Array.from(acceptedRows.values()).sort((left, right) => left.playerId - right.playerId),
    malformedRows,
    duplicateRows,
    conflictingRows,
  };
}

function parseCsvLine(line) {
  const columns = [];
  let current = "";
  let insideQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const nextCharacter = line[index + 1];

    if (character === '"') {
      if (insideQuotes && nextCharacter === '"') {
        current += '"';
        index += 1;
        continue;
      }

      insideQuotes = !insideQuotes;
      continue;
    }

    if (character === "," && !insideQuotes) {
      columns.push(current.trim());
      current = "";
      continue;
    }

    current += character;
  }

  columns.push(current.trim());
  return columns;
}

function parsePositiveInteger(value) {
  const normalized = String(value ?? "").trim();

  if (!/^\d+$/.test(normalized)) {
    return Number.NaN;
  }

  const parsed = Number.parseInt(normalized, 10);
  return parsed > 0 ? parsed : Number.NaN;
}

async function loadExistingPlayers(supabase, playerIds) {
  const playersById = new Map();

  for (const batch of chunk(playerIds, 200)) {
    const { data, error } = await supabase
      .from("player")
      .select("id, shirt_number")
      .in("id", batch);

    if (error) {
      throw new Error(`Could not read player rows: ${error.message}`);
    }

    for (const player of data ?? []) {
      playersById.set(player.id, player);
    }
  }

  return playersById;
}

function chunk(items, size) {
  const chunks = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

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
  const key =
    process.env.SUPABASE_COUNTRY_IMPORT_KEY ??
    process.env.SUPABASE_SECRET_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY;

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
        "X-Client-Info": "wc26-shirt-number-import",
      },
    },
  });
}

function printSummary(summary) {
  console.log(`Input CSV: ${summary.input_path}`);
  console.log(`Mode: ${summary.mode}`);
  console.log(`Rows scanned: ${summary.rows_scanned}`);
  console.log(`Ready to import: ${summary.ready_to_import}`);
  console.log(`Skipped malformed: ${summary.skipped.malformed}`);
  console.log(`Skipped duplicate: ${summary.skipped.duplicate}`);
  console.log(`Skipped conflicting: ${summary.skipped.conflicting}`);

  printRowDetails(summary.details.malformed_rows, "Malformed rows");
  printRowDetails(summary.details.duplicate_rows, "Duplicate rows");
  printRowDetails(summary.details.conflicting_rows, "Conflicting rows");

  if (summary.mode === "dry-run") {
    console.log("[DRY RUN] No changes written. Use --write to update public.player.shirt_number in Supabase.");
    return;
  }

  console.log(`Write attempted: ${summary.write.attempted}`);
  console.log(`Updated: ${summary.write.updated}`);
  console.log(`Unchanged: ${summary.write.unchanged}`);
  console.log(`Missing players: ${summary.write.missing_players}`);
  console.log(`Failures: ${summary.write.failures}`);

  if (summary.write.failure_details.length > 0) {
    console.log("Write failures:");
    for (const failure of summary.write.failure_details) {
      console.log(`  - line ${failure.line}: player_id=${failure.player_id}, shirt_number=${failure.shirt_number} — ${failure.reason}`);
    }
  }
}

function printRowDetails(rows, label) {
  if (rows.length === 0) {
    return;
  }

  console.log(`${label}:`);

  for (const row of rows) {
    console.log(
      `  - line ${row.line}: ${row.reason}${row.raw ? ` Raw: ${row.raw}` : ` player_id=${row.player_id}, shirt_number=${row.shirt_number}`}`,
    );
  }
}

function normalizePath(filePath) {
  return String(filePath ?? "").replaceAll("\\", "/");
}

function printHelp() {
  console.log(`Usage: node scripts/import-player-shirt-numbers.mjs [--input generated/match-summary-ingest/shirt-number-updates/shirt-numbers.csv] [--write]

Imports valid shirt numbers into public.player by id.
Default mode is dry-run; --write performs the actual Supabase updates.`);
}

function isDirectExecution() {
  return process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false;
}
