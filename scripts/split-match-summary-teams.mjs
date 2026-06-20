#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getOptionValue } from "./lib/qualified-countries.mjs";
import { resolveSafeTeamSlug } from "./lib/match-summary-pipeline-paths.mjs";
import { resolveTeamSlug } from "./lib/team-slug-resolver.mjs";

if (isDirectExecution()) {
  const argv = process.argv.slice(2);

  if (argv.includes("--help") || argv.includes("-h")) {
    printHelp();
    process.exit(0);
  }

  const inputPath = getOptionValue(argv, "--input");
  const outputDir = getOptionValue(argv, "--output-dir") ?? "generated/match-summary-ingest/teams";

  if (!inputPath) {
    console.error("Missing required --input <parsed-match-json> option.");
    process.exit(1);
  }

  try {
    const result = await runSplitMatchSummaryTeams({ inputPath, outputDir });
    console.log(`Team artifacts written to ${result.output_dir}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

export async function runSplitMatchSummaryTeams({ inputPath, outputDir = "generated/match-summary-ingest/teams" }) {
  const parsedMatchPath = resolve(process.cwd(), inputPath);
  const parsedMatch = JSON.parse(readFileSync(parsedMatchPath, "utf8"));
  const matchId = parsedMatch.match_id ?? inferMatchId(parsedMatchPath);
  const resolvedOutputDir = resolve(process.cwd(), outputDir);
  const homeArtifact = buildTeamArtifact(parsedMatch, "home", parsedMatchPath);
  const awayArtifact = buildTeamArtifact(parsedMatch, "away", parsedMatchPath);

  mkdirSync(resolvedOutputDir, { recursive: true });

  const homeOutputPath = writeTeamArtifact(resolvedOutputDir, matchId, homeArtifact);
  const awayOutputPath = writeTeamArtifact(resolvedOutputDir, matchId, awayArtifact);

  return {
    match_id: matchId,
    output_dir: resolvedOutputDir,
    artifacts: [homeArtifact, awayArtifact],
    output_paths: [homeOutputPath, awayOutputPath],
  };
}

function buildTeamArtifact(parsedMatch, side, parsedMatchPath) {
  const team = parsedMatch.teams?.[side];
  const opponent = parsedMatch.teams?.[side === "home" ? "away" : "home"];

  if (!team) {
    throw new Error(`Parsed match is missing the ${side} team payload.`);
  }

  const resolution = team.resolution?.resolved ? team.resolution : resolveTeamSlug(team.name ?? "");
  const opponentResolution = opponent?.resolution?.resolved ? opponent.resolution : resolveTeamSlug(opponent?.name ?? "");

  if (!resolution?.resolved) {
    throw new Error(`Unable to resolve ${side} team name from OCR: ${summarizeTeamName(team?.name)}.`);
  }

  if (!opponentResolution?.resolved) {
    throw new Error(`Unable to resolve ${side === "home" ? "away" : "home"} team name from OCR: ${summarizeTeamName(opponent?.name)}.`);
  }

  return {
    schema_version: "match-summary-team-v1",
    match_id: parsedMatch.match_id ?? null,
    side,
    source: {
      parsed_match_path: parsedMatchPath,
      parser_version: parsedMatch.parser_version ?? null,
    },
    match: {
      opponent_name: opponent?.name ?? null,
      opponent_slug: opponentResolution.slug,
      team_score: side === "home" ? parsedMatch.match?.home_score ?? null : parsedMatch.match?.away_score ?? null,
      opponent_score: side === "home" ? parsedMatch.match?.away_score ?? null : parsedMatch.match?.home_score ?? null,
      date: parsedMatch.match?.date ?? null,
      venue: parsedMatch.match?.venue ?? null,
      competition: parsedMatch.match?.competition ?? null,
    },
    team: {
      name: team.name,
      slug: resolution.slug,
      folder: resolution.folder,
      formation: team.formation,
      starters: team.starters ?? [],
      substitutes: team.substitutes ?? [],
      resolution,
      warnings: team.warnings ?? [],
    },
  };
}

function writeTeamArtifact(outputDir, matchId, artifact) {
  const teamSlug = resolveSafeTeamSlug({ team: artifact.team }, { teamName: artifact.team.name });
  const outputPath = resolve(outputDir, `${matchId}-${teamSlug}.team.json`);
  writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
  return outputPath;
}

function inferMatchId(parsedMatchPath) {
  const fileName = basename(parsedMatchPath);
  const match = fileName.match(/^(.+?)\.parsed\.json$/);
  return match?.[1] ?? "match-summary";
}

function printHelp() {
  console.log(`Usage: node scripts/split-match-summary-teams.mjs --input <parsed-match-json> [--output-dir generated/match-summary-ingest/teams]

Reads one parsed match artifact and writes one team artifact per side.`);
}

function isDirectExecution() {
  return process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false;
}

function summarizeTeamName(value) {
  const normalized = String(value ?? "").replace(/\s+/g, " ").trim();

  if (!normalized) {
    return '"(empty)"';
  }

  return normalized.length > 40 ? `"${normalized.slice(0, 37)}..."` : `"${normalized}"`;
}
