#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateShirtNumberUpdateArtifact } from "./lib/match-summary-validator.mjs";
import { getOptionValue } from "./lib/qualified-countries.mjs";

if (isDirectExecution()) {
  const argv = process.argv.slice(2);

  if (argv.includes("--help") || argv.includes("-h")) {
    printHelp();
    process.exit(0);
  }

  const inputDir = resolve(process.cwd(), getOptionValue(argv, "--input-dir") ?? "generated/match-summary-ingest/shirt-number-updates");
  const strictMode = argv.includes("--strict");

  try {
    const summary = exportShirtNumberCsv({ inputDir, strictMode });

    console.log(`CSV written to ${summary.output_path}`);
    console.log(
      `Resolved rows: ${summary.rows_written}. Unresolved entries: ${summary.unresolved_count}. Conflicts: ${summary.conflict_count}.`,
    );

    if (summary.validation_errors.length > 0) {
      console.error(`Validation errors: ${summary.validation_errors.length}`);
      process.exit(1);
    }

    if (strictMode && (summary.unresolved_count > 0 || summary.conflict_count > 0)) {
      console.error("Strict mode failed because unresolved entries or conflicts were detected.");
      process.exit(1);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

export function exportShirtNumberCsv({ inputDir, strictMode = false }) {
  if (!existsSync(inputDir)) {
    throw new Error(`Input directory does not exist: ${inputDir}`);
  }

  const artifactPaths = readdirSync(inputDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".shirt-numbers.json"))
    .map((entry) => resolve(inputDir, entry.name))
    .sort((left, right) => left.localeCompare(right, "en"));

  if (artifactPaths.length === 0) {
    throw new Error(`No .shirt-numbers.json files were found in ${inputDir}.`);
  }

  const acceptedRows = new Map();
  const conflictedPlayerIds = new Set();
  const conflicts = [];
  const duplicateRows = [];
  const unresolvedEntries = [];
  const validationErrors = [];
  const validationWarnings = [];

  for (const artifactPath of artifactPaths) {
    let artifact;

    try {
      artifact = JSON.parse(readFileSync(artifactPath, "utf8"));
    } catch (error) {
      validationErrors.push({
        path: normalizePath(artifactPath),
        errors: [{ code: "invalid_json", message: error instanceof Error ? error.message : String(error) }],
      });
      continue;
    }

    const validation = validateShirtNumberUpdateArtifact(artifact, { filePath: artifactPath });

    if (validation.errors.length > 0) {
      validationErrors.push({ path: normalizePath(artifactPath), errors: validation.errors });
      continue;
    }

    if (validation.warnings.length > 0) {
      validationWarnings.push({ path: normalizePath(artifactPath), warnings: validation.warnings });
    }

    for (const unresolved of artifact.unresolved ?? []) {
      unresolvedEntries.push({ path: normalizePath(artifactPath), entry: unresolved });
    }

    for (const update of artifact.updates ?? []) {
      const playerId = normalizePlayerId(update.matched_player_id);
      const shirtNumber = parseShirtNumber(update.shirt_number);

      if (!playerId || !Number.isInteger(shirtNumber)) {
        unresolvedEntries.push({
          path: normalizePath(artifactPath),
          entry: {
            captured_name: update?.captured_name ?? null,
            matched_player_id: update?.matched_player_id ?? null,
            shirt_number: update?.shirt_number ?? null,
            reason: "Update did not contain both matched_player_id and a valid shirt_number.",
          },
        });
        continue;
      }

      const existing = acceptedRows.get(playerId);

      if (!existing) {
        acceptedRows.set(playerId, {
          player_id: playerId,
          shirt_number: shirtNumber,
          sources: [normalizePath(artifactPath)],
        });
        continue;
      }

      if (existing.shirt_number === shirtNumber) {
        existing.sources.push(normalizePath(artifactPath));
        duplicateRows.push({
          player_id: playerId,
          shirt_number: shirtNumber,
          path: normalizePath(artifactPath),
        });
        continue;
      }

      conflictedPlayerIds.add(playerId);
      acceptedRows.delete(playerId);
      conflicts.push({
        player_id: playerId,
        first_shirt_number: existing.shirt_number,
        second_shirt_number: shirtNumber,
        first_sources: existing.sources,
        second_source: normalizePath(artifactPath),
      });
    }
  }

  const rows = Array.from(acceptedRows.values())
    .filter((row) => !conflictedPlayerIds.has(row.player_id))
    .sort((left, right) => left.player_id.localeCompare(right.player_id, "en"));
  const outputPath = resolve(inputDir, "shirt-numbers.csv");

  writeFileSync(outputPath, toCsv(rows), "utf8");

  return {
    schema_version: "shirt-number-csv-export-summary-v1",
    strict_mode: strictMode,
    output_path: normalizePath(outputPath),
    input_dir: normalizePath(inputDir),
    rows_written: rows.length,
    unresolved_count: unresolvedEntries.length,
    conflict_count: conflicts.length,
    duplicate_count: duplicateRows.length,
    validation_errors: validationErrors,
    validation_warnings: validationWarnings,
    conflicts,
    unresolved_entries: unresolvedEntries,
  };
}

function toCsv(rows) {
  const header = "player_id,shirt_number";
  const lines = rows.map((row) => `${escapeCsv(row.player_id)},${row.shirt_number}`);
  return `${[header, ...lines].join("\n")}\n`;
}

function escapeCsv(value) {
  const stringValue = String(value ?? "");
  return /[",\n]/.test(stringValue) ? `"${stringValue.replaceAll('"', '""')}"` : stringValue;
}

function normalizePlayerId(value) {
  if (value == null) return null;
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

function parseShirtNumber(value) {
  if (typeof value === "number") {
    return Number.isInteger(value) ? value : Number.NaN;
  }

  if (typeof value === "string" && value.trim()) {
    return Number.parseInt(value, 10);
  }

  return Number.NaN;
}

function normalizePath(filePath) {
  return String(filePath ?? "").replaceAll("\\", "/");
}

function printHelp() {
  console.log(`Usage: node scripts/export-shirt-number-csv.mjs [--input-dir generated/match-summary-ingest/shirt-number-updates] [--strict]

Aggregates resolved matched_player_id values into shirt-numbers.csv.
Only rows with matched_player_id are exported.`);
}

function isDirectExecution() {
  return process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false;
}
