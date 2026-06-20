#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { matchCapturedPlayersToRoster } from "./lib/team-player-matcher.mjs";
import { createTeamRosterSource } from "./lib/team-roster-source.mjs";
import { writeJson, toRelativePath } from "./lib/fbref-player-export.mjs";
import {
  DEFAULT_MATCH_SUMMARY_OUTPUT_ROOT,
  SHIRT_NUMBER_UPDATE_DIRECTORY,
  getShirtNumberOutputPath,
  getTeamArtifactIdentity,
} from "./lib/match-summary-pipeline-paths.mjs";
import { getOptionValue } from "./lib/qualified-countries.mjs";

if (isDirectExecution()) {
  const argv = process.argv.slice(2);

  if (argv.includes("--help") || argv.includes("-h")) {
    printHelp();
    process.exit(0);
  }

  const inputDir = resolve(process.cwd(), getOptionValue(argv, "--input-dir") ?? "generated/match-summary-ingest/teams");
  const outputDir = resolve(
    process.cwd(),
    getOptionValue(argv, "--output-dir") ?? `${DEFAULT_MATCH_SUMMARY_OUTPUT_ROOT}/${SHIRT_NUMBER_UPDATE_DIRECTORY}`,
  );
  const rosterFixtureDir = getOptionValue(argv, "--roster-fixture-dir");

  try {
    const summary = await runMatchTeamShirtNumbers({ inputDir, outputDir, rosterFixtureDir });

    console.log(`Processed ${summary.total_files} team artifacts: ${summary.processed_count} matched, ${summary.failed_count} failed.`);

    if (summary.failed_count > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

export async function runMatchTeamShirtNumbers({
  inputDir,
  outputDir = `${DEFAULT_MATCH_SUMMARY_OUTPUT_ROOT}/${SHIRT_NUMBER_UPDATE_DIRECTORY}`,
  rosterFixtureDir = null,
}) {
  const resolvedInputDir = resolve(process.cwd(), inputDir);
  const resolvedOutputDir = resolve(process.cwd(), outputDir);

  if (!existsSync(resolvedInputDir)) {
    throw new Error(`Input directory does not exist: ${resolvedInputDir}`);
  }

  const teamFiles = readdirSync(resolvedInputDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".team.json"))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right, "en"));

  if (teamFiles.length === 0) {
    throw new Error(`No .team.json files were found in ${resolvedInputDir}.`);
  }

  const rosterSource = createTeamRosterSource({ rosterFixtureDir });
  const artifacts = [];
  let processedCount = 0;
  let failedCount = 0;

  for (const fileName of teamFiles) {
    const artifactPath = resolve(resolvedInputDir, fileName);

    try {
      const teamArtifact = JSON.parse(readFileSync(artifactPath, "utf8"));
      const identity = getTeamArtifactIdentity(teamArtifact, { artifactPath });

      if (!identity.team_slug) {
        throw new Error(`Team artifact ${fileName} is missing team.slug.`);
      }

      if (!identity.team_name) {
        throw new Error(`Team artifact ${fileName} is missing team.name.`);
      }

      const capturedPlayers = collectCapturedPlayers(teamArtifact);
      const roster = await rosterSource.loadTeamRoster({
        teamSlug: identity.team_slug,
        teamName: identity.team_name,
      });
      const matchResult = matchCapturedPlayersToRoster({
        teamSlug: identity.team_slug,
        capturedPlayers,
        rosterPlayers: roster.players,
      });

      const outputPath = getShirtNumberOutputPath({
        outputDir: resolvedOutputDir,
        teamArtifact,
        artifactPath,
      });
      const outputArtifact = {
        schema_version: "team-shirt-number-updates-v1",
        match_id: identity.match_id,
        side: teamArtifact?.side ?? null,
        team: {
          slug: identity.team_slug,
          name: identity.team_name,
          folder: teamArtifact?.team?.folder ?? null,
        },
        source: {
          team_artifact_path: toRelativePath(artifactPath),
          roster_source: roster.source,
        },
        updates: matchResult.updates,
        unresolved: matchResult.unresolved,
        warnings: [
          ...new Set([...(teamArtifact?.team?.warnings ?? []), ...matchResult.warnings]),
        ],
      };

      writeJson(outputPath, outputArtifact);
      artifacts.push({
        status: "success",
        match_id: identity.match_id,
        team_slug: identity.team_slug,
        team_name: identity.team_name,
        source_team_artifact_path: artifactPath,
        output_path: outputPath,
        updates: matchResult.updates.length,
        unresolved: matchResult.unresolved.length,
      });
      processedCount += 1;

      console.log(
        `Matched ${identity.match_id}/${identity.team_slug}: ${matchResult.updates.length} updates, ${matchResult.unresolved.length} unresolved -> ${toRelativePath(outputPath)}`,
      );
    } catch (error) {
      artifacts.push({
        status: "failed",
        source_team_artifact_path: artifactPath,
        error: error instanceof Error ? error.message : String(error),
      });
      failedCount += 1;
      console.error(`[ERROR] ${fileName}: ${error instanceof Error ? error.message : error}`);
    }
  }

  return {
    schema_version: "team-shirt-number-match-summary-v1",
    input_dir: resolvedInputDir,
    output_dir: resolvedOutputDir,
    roster_fixture_dir: rosterFixtureDir ? resolve(process.cwd(), rosterFixtureDir) : null,
    total_files: teamFiles.length,
    processed_count: processedCount,
    failed_count: failedCount,
    artifacts,
  };
}

function collectCapturedPlayers(teamArtifact) {
  const starters = Array.isArray(teamArtifact?.team?.starters) ? teamArtifact.team.starters : [];
  const substitutes = Array.isArray(teamArtifact?.team?.substitutes) ? teamArtifact.team.substitutes : [];

  return [...starters, ...substitutes].map((player) => ({
    name: String(player?.name ?? "").trim(),
    shirt_number: Number.isInteger(Number.parseInt(player?.shirt_number, 10))
      ? Number.parseInt(player.shirt_number, 10)
      : null,
    position: player?.position ?? null,
  }));
}

function printHelp() {
  console.log(`Usage: node scripts/match-team-shirt-numbers.mjs [--input-dir generated/match-summary-ingest/teams] [--output-dir generated/match-summary-ingest/shirt-number-updates] [--roster-fixture-dir <dir>]

Matches captured team-artifact player names against the same team's roster.
Outputs are match-scoped (<match-id>-<team-slug>.shirt-numbers.json) to avoid overwriting prior matches.
If --roster-fixture-dir is omitted, the script reads country/player rows from Supabase.`);
}

function isDirectExecution() {
  return process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false;
}
