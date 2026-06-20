#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { writeJson, toRelativePath } from "./lib/fbref-player-export.mjs";
import { exportTeamArtifactToFormationInput } from "./lib/formation-exporter.mjs";
import {
  DEFAULT_MATCH_SUMMARY_OUTPUT_ROOT,
  FORMATION_EXPORT_DIRECTORY,
  getCanonicalFormationOutputPath,
  getFormationExportOutputPath,
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
  const outputRoot = resolve(
    process.cwd(),
    getOptionValue(argv, "--output-root") ?? `${DEFAULT_MATCH_SUMMARY_OUTPUT_ROOT}/${FORMATION_EXPORT_DIRECTORY}`,
  );
  const samplesRoot = resolve(process.cwd(), "samples/teams");
  const writeCanonical = argv.includes("--write-canonical");

  try {
    const summary = runExportTeamFormationInputs({
      inputDir,
      outputRoot,
      samplesRoot,
      writeCanonical,
    });

    console.log(`Processed ${summary.total_files} team artifacts: ${summary.exported_count} exported, ${summary.failed_count} failed.`);

    if (summary.failed_count > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

export function runExportTeamFormationInputs({
  inputDir,
  outputRoot = `${DEFAULT_MATCH_SUMMARY_OUTPUT_ROOT}/${FORMATION_EXPORT_DIRECTORY}`,
  samplesRoot = resolve(process.cwd(), "samples/teams"),
  writeCanonical = false,
}) {
  const resolvedInputDir = resolve(process.cwd(), inputDir);
  const resolvedOutputRoot = resolve(process.cwd(), outputRoot);
  const resolvedSamplesRoot = resolve(process.cwd(), samplesRoot);

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

  const artifacts = [];
  let exportedCount = 0;
  let failedCount = 0;

  for (const fileName of teamFiles) {
    const artifactPath = resolve(resolvedInputDir, fileName);

    try {
      const teamArtifact = JSON.parse(readFileSync(artifactPath, "utf8"));
      const formationInput = exportTeamArtifactToFormationInput(teamArtifact);
      const identity = getTeamArtifactIdentity(teamArtifact, { artifactPath });
      const stagedOutputPath = getFormationExportOutputPath({
        outputRoot: resolvedOutputRoot,
        teamArtifact,
        artifactPath,
      });

      writeJson(stagedOutputPath, formationInput);

      let canonicalOutputPath = null;

      if (writeCanonical) {
        canonicalOutputPath = getCanonicalFormationOutputPath({
          samplesRoot: resolvedSamplesRoot,
          teamArtifact,
          artifactPath,
        });
        writeJson(canonicalOutputPath, formationInput);
      }

      artifacts.push({
        status: "success",
        match_id: identity.match_id,
        team_slug: identity.team_slug,
        team_name: identity.team_name,
        source_team_artifact_path: artifactPath,
        output_path: stagedOutputPath,
        canonical_output_path: canonicalOutputPath,
      });
      exportedCount += 1;

      console.log(
        `Exported ${formationInput.team.name} -> ${toRelativePath(stagedOutputPath)}${
          canonicalOutputPath ? ` (canonical: ${toRelativePath(canonicalOutputPath)})` : ""
        }`,
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
    schema_version: "team-formation-export-summary-v1",
    input_dir: resolvedInputDir,
    output_root: resolvedOutputRoot,
    canonical_samples_root: resolvedSamplesRoot,
    write_canonical: writeCanonical,
    total_files: teamFiles.length,
    exported_count: exportedCount,
    failed_count: failedCount,
    artifacts,
  };
}

function printHelp() {
  console.log(`Usage: node scripts/export-team-formation-inputs.mjs [--input-dir generated/match-summary-ingest/teams] [--output-root generated/match-summary-ingest/formation-exports] [--write-canonical]

Reads team artifacts and always writes match-scoped staged formation inputs under --output-root.
Use --write-canonical to additionally mirror outputs into samples/teams/<Team>/country-formation-input.json.
Invalid team artifacts fail loudly and keep a non-zero exit code.`);
}

function isDirectExecution() {
  return process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false;
}
