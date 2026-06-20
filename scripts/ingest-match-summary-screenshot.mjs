#!/usr/bin/env node

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getOptionValue } from "./lib/qualified-countries.mjs";
import { disposeMatchSummaryOcr, extractMatchSummaryOcr } from "./lib/match-summary-ocr.mjs";
import { parseMatchSummary } from "./lib/match-summary-parser.mjs";
import { resolveTeamSlug } from "./lib/team-slug-resolver.mjs";

if (isDirectExecution()) {
  const argv = process.argv.slice(2);

  if (argv.includes("--help") || argv.includes("-h")) {
    printHelp();
    process.exit(0);
  }

  const inputPath = getOptionValue(argv, "--input");
  const matchId = getOptionValue(argv, "--match-id");
  const outputRoot = getOptionValue(argv, "--output-root") ?? "generated/match-summary-ingest";

  if (!inputPath) {
    console.error("Missing required --input <path-to-screenshot> option.");
    process.exit(1);
  }

  if (!matchId) {
    console.error("Missing required --match-id <id> option.");
    process.exit(1);
  }

  try {
    const result = await runIngestMatchSummaryScreenshot({ inputPath, matchId, outputRoot });

    console.log(`Raw OCR artifact written to ${result.output_paths.raw}`);
    console.log(`Parsed match artifact written to ${result.output_paths.parsed}`);
    console.log(`Ingest report written to ${result.output_paths.report}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await disposeMatchSummaryOcr();
  }
}

export async function runIngestMatchSummaryScreenshot({ inputPath, matchId, outputRoot = "generated/match-summary-ingest" }) {
  const resolvedOutputRoot = resolve(process.cwd(), outputRoot);
  const outputPaths = {
    raw: resolve(resolvedOutputRoot, "raw", `${matchId}.raw.json`),
    parsed: resolve(resolvedOutputRoot, "parsed", `${matchId}.parsed.json`),
    report: resolve(resolvedOutputRoot, "reports", `${matchId}.report.json`),
  };

  ensureBaseDirectories(resolvedOutputRoot);

  const rawOcr = await extractMatchSummaryOcr({ imagePath: inputPath });
  const parsedMatch = parseMatchSummary({
    ...rawOcr,
    matchId,
  });
  const enrichedMatch = enrichWithTeamResolutions(parsedMatch);
  const report = buildReport({
    inputPath,
    matchId,
    rawOcr,
    parsedMatch: enrichedMatch,
    rawOutputPath: outputPaths.raw,
    parsedOutputPath: outputPaths.parsed,
  });

  writeJson(outputPaths.raw, rawOcr);
  writeJson(outputPaths.parsed, enrichedMatch);
  writeJson(outputPaths.report, report);

  return {
    match_id: matchId,
    raw_ocr: rawOcr,
    parsed_match: enrichedMatch,
    report,
    output_paths: outputPaths,
  };
}

function ensureBaseDirectories(outputRootPath) {
  const directories = [
    resolve(process.cwd(), "sources", "match-summaries"),
    resolve(outputRootPath, "raw"),
    resolve(outputRootPath, "parsed"),
    resolve(outputRootPath, "reports"),
    resolve(outputRootPath, "teams"),
  ];

  for (const directoryPath of directories) {
    mkdirSync(directoryPath, { recursive: true });
  }
}

function enrichWithTeamResolutions(parsedMatch) {
  const homeResolution = resolveTeamSlug(parsedMatch.teams.home.name ?? parsedMatch.match.home_team_name ?? "", {
    playerNames: collectTeamPlayerNames(parsedMatch.teams.home),
  });
  const awayResolution = resolveTeamSlug(parsedMatch.teams.away.name ?? parsedMatch.match.away_team_name ?? "", {
    playerNames: collectTeamPlayerNames(parsedMatch.teams.away),
  });
  const canonicalHomeName = homeResolution.resolved ? homeResolution.name : parsedMatch.teams.home.name;
  const canonicalAwayName = awayResolution.resolved ? awayResolution.name : parsedMatch.teams.away.name;

  return {
    ...parsedMatch,
    source: {
      kind: "match-summary-screenshot",
    },
    match: {
      ...parsedMatch.match,
      home_team_name: homeResolution.resolved
        ? homeResolution.name
        : (parsedMatch.match.home_team_name ?? canonicalHomeName),
      away_team_name: awayResolution.resolved
        ? awayResolution.name
        : (parsedMatch.match.away_team_name ?? canonicalAwayName),
    },
    teams: {
      home: {
        ...parsedMatch.teams.home,
        name: canonicalHomeName,
        resolution: homeResolution,
      },
      away: {
        ...parsedMatch.teams.away,
        name: canonicalAwayName,
        resolution: awayResolution,
      },
    },
  };
}

function collectTeamPlayerNames(team) {
  return [...(team?.starters ?? []), ...(team?.substitutes ?? [])]
    .map((player) => String(player?.name ?? "").trim())
    .filter(Boolean);
}

function buildReport({ inputPath, matchId, rawOcr, parsedMatch, rawOutputPath, parsedOutputPath }) {
  const warnings = Array.from(
    new Set([
      ...parsedMatch.warnings,
      ...parsedMatch.teams.home.warnings,
      ...parsedMatch.teams.away.warnings,
      ...(parsedMatch.teams.home.resolution?.resolved ? [] : [parsedMatch.teams.home.resolution?.reason]),
      ...(parsedMatch.teams.away.resolution?.resolved ? [] : [parsedMatch.teams.away.resolution?.reason]),
    ].filter(Boolean)),
  );

  return {
    schema_version: "match-summary-report-v1",
    match_id: matchId,
    source_image_path: resolve(process.cwd(), inputPath),
    files: {
      raw: rawOutputPath,
      parsed: parsedOutputPath,
    },
    ocr: {
      layout_version: rawOcr.layoutVersion,
      provider: rawOcr.metadata?.provider ?? null,
    },
    summary: {
      home_team: parsedMatch.teams.home.name,
      away_team: parsedMatch.teams.away.name,
      home_score: parsedMatch.match.home_score,
      away_score: parsedMatch.match.away_score,
      venue: parsedMatch.match.venue,
      date: parsedMatch.match.date,
      home_formation: parsedMatch.teams.home.formation,
      away_formation: parsedMatch.teams.away.formation,
      home_starters: parsedMatch.teams.home.starters.length,
      away_starters: parsedMatch.teams.away.starters.length,
      home_substitutes: parsedMatch.teams.home.substitutes.length,
      away_substitutes: parsedMatch.teams.away.substitutes.length,
    },
    team_resolution: {
      home: parsedMatch.teams.home.resolution,
      away: parsedMatch.teams.away.resolution,
    },
    warnings,
  };
}

function writeJson(filePath, value) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function printHelp() {
  console.log(`Usage: node scripts/ingest-match-summary-screenshot.mjs --input <screenshot-path> --match-id <id> [--output-root generated/match-summary-ingest]

Ingests one screenshot source into raw OCR, parsed match, and report artifacts.
By default JPG/PNG screenshots run through the local tesseract.js OCR runtime.
If you want deterministic fixture-driven OCR for debugging, set MATCH_SUMMARY_OCR_PROVIDER=fixture and place a sibling fixture next to the screenshot basename:
  - <basename>.ocr.json
  - <basename>.left.txt + .center.txt + .right.txt
  - <basename>.ocr.txt`);
}

function isDirectExecution() {
  return process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false;
}
