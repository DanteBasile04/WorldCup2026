#!/usr/bin/env node

import { existsSync, readdirSync, writeFileSync } from "node:fs";
import { basename, extname, resolve } from "node:path";
import { writeJson } from "./lib/fbref-player-export.mjs";
import { disposeMatchSummaryOcr } from "./lib/match-summary-ocr.mjs";
import {
  DEFAULT_MATCH_SUMMARY_OUTPUT_ROOT,
  FORMATION_EXPORT_DIRECTORY,
  SHIRT_NUMBER_UPDATE_DIRECTORY,
  normalizePath,
} from "./lib/match-summary-pipeline-paths.mjs";
import { getOptionValue } from "./lib/qualified-countries.mjs";
import { exportShirtNumberCsv } from "./export-shirt-number-csv.mjs";
import { runExportTeamFormationInputs } from "./export-team-formation-inputs.mjs";
import { runIngestMatchSummaryScreenshot } from "./ingest-match-summary-screenshot.mjs";
import { runMatchTeamShirtNumbers } from "./match-team-shirt-numbers.mjs";
import { runSplitMatchSummaryTeams } from "./split-match-summary-teams.mjs";
import { runValidateMatchSummaryIngest } from "./validate-match-summary-ingest.mjs";

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tif", ".tiff"]);

const argv = process.argv.slice(2);

if (argv.includes("--help") || argv.includes("-h")) {
  printHelp();
  process.exit(0);
}

const inputDir = resolve(process.cwd(), getOptionValue(argv, "--input-dir") ?? "sources/match-summaries");
const outputRoot = resolve(process.cwd(), getOptionValue(argv, "--output-root") ?? DEFAULT_MATCH_SUMMARY_OUTPUT_ROOT);
const formationOutputRoot = resolve(
  process.cwd(),
  getOptionValue(argv, "--formation-output-root") ?? resolve(outputRoot, FORMATION_EXPORT_DIRECTORY),
);
const shirtOutputDir = resolve(
  process.cwd(),
  getOptionValue(argv, "--shirt-output-dir") ?? resolve(outputRoot, SHIRT_NUMBER_UPDATE_DIRECTORY),
);
const rosterFixtureDir = getOptionValue(argv, "--roster-fixture-dir");
const writeCanonicalFormations = argv.includes("--write-canonical-formations");
const strictCsv = argv.includes("--strict-csv");

try {
  const summary = await runBatchIngestMatchSummaries({
    inputDir,
    outputRoot,
    formationOutputRoot,
    shirtOutputDir,
    rosterFixtureDir,
    writeCanonicalFormations,
    strictCsv,
  });

  console.log(`Batch JSON written to ${summary.files.json_report}`);
  console.log(`Batch Markdown written to ${summary.files.markdown_report}`);
  console.log(`Processed ${summary.totals.succeeded}/${summary.totals.discovered} sources successfully.`);

  if (hasBlockingFailures(summary)) {
    process.exitCode = 1;
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await disposeMatchSummaryOcr();
}

export async function runBatchIngestMatchSummaries({
  inputDir,
  outputRoot,
  formationOutputRoot = resolve(outputRoot, FORMATION_EXPORT_DIRECTORY),
  shirtOutputDir = resolve(outputRoot, SHIRT_NUMBER_UPDATE_DIRECTORY),
  rosterFixtureDir = null,
  writeCanonicalFormations = false,
  strictCsv = false,
}) {
  if (!existsSync(inputDir)) {
    throw new Error(`Input directory does not exist: ${inputDir}`);
  }

  const sources = discoverBatchSources(inputDir);

  if (sources.length === 0) {
    throw new Error(`No supported screenshots or OCR fixtures were found in ${inputDir}.`);
  }

  const items = [];

  for (const source of sources) {
    try {
      const ingestResult = await runIngestMatchSummaryScreenshot({
        inputPath: source.input_path,
        matchId: source.match_id,
        outputRoot,
      });
      const splitResult = await runSplitMatchSummaryTeams({
        inputPath: ingestResult.output_paths.parsed,
        outputDir: resolve(outputRoot, "teams"),
      });

      items.push({
        match_id: source.match_id,
        source_kind: source.source_kind,
        input_path: normalizePath(source.input_path),
        status: "success",
        files: {
          raw: normalizePath(ingestResult.output_paths.raw),
          parsed: normalizePath(ingestResult.output_paths.parsed),
          report: normalizePath(ingestResult.output_paths.report),
          teams: splitResult.output_paths.map(normalizePath),
        },
      });
    } catch (error) {
      items.push({
        match_id: source.match_id,
        source_kind: source.source_kind,
        input_path: normalizePath(source.input_path),
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const successfulItems = items.filter((item) => item.status === "success");
  const formationExportSummary = successfulItems.length > 0
    ? runExportTeamFormationInputs({
      inputDir: resolve(outputRoot, "teams"),
      outputRoot: formationOutputRoot,
      writeCanonical: writeCanonicalFormations,
    })
    : null;
  const shirtNumberSummary = successfulItems.length > 0
    ? await runMatchTeamShirtNumbers({
      inputDir: resolve(outputRoot, "teams"),
      outputDir: shirtOutputDir,
      rosterFixtureDir,
    })
    : null;
  const csvSummary = shirtNumberSummary && shirtNumberSummary.processed_count > 0
    ? exportShirtNumberCsv({ inputDir: shirtOutputDir, strictMode: strictCsv })
    : null;
  const validationSummary = successfulItems.length > 0
    ? runValidateMatchSummaryIngest({ inputDir: outputRoot })
    : null;

  const formationByTeamArtifact = indexArtifactsBySourcePath(formationExportSummary?.artifacts ?? []);
  const shirtByTeamArtifact = indexArtifactsBySourcePath(shirtNumberSummary?.artifacts ?? []);

  for (const item of successfulItems) {
    const formationExports = [];
    const shirtNumberArtifacts = [];

    for (const teamPath of item.files.teams) {
      const formationArtifact = formationByTeamArtifact.get(teamPath);
      const shirtArtifact = shirtByTeamArtifact.get(teamPath);

      if (formationArtifact?.status === "success") {
        formationExports.push(normalizePath(formationArtifact.output_path));
      }

      if (shirtArtifact?.status === "success") {
        shirtNumberArtifacts.push(normalizePath(shirtArtifact.output_path));
      }
    }

    item.files.formation_exports = formationExports;
    item.files.shirt_number_updates = shirtNumberArtifacts;
  }

  const reportsDir = resolve(outputRoot, "reports");
  const jsonReportPath = resolve(reportsDir, "batch-summary.json");
  const markdownReportPath = resolve(reportsDir, "batch-summary.md");
  const summary = {
    schema_version: "match-summary-batch-summary-v1",
    generated_at: new Date().toISOString(),
    input_dir: normalizePath(inputDir),
    output_root: normalizePath(outputRoot),
    totals: {
      discovered: sources.length,
      succeeded: items.filter((item) => item.status === "success").length,
      failed: items.filter((item) => item.status === "failed").length,
    },
    pipeline: {
      formation_exports: formationExportSummary
        ? {
          exported: formationExportSummary.exported_count,
          failed: formationExportSummary.failed_count,
          output_root: normalizePath(formationExportSummary.output_root),
          write_canonical: formationExportSummary.write_canonical,
        }
        : null,
      shirt_number_matching: shirtNumberSummary
        ? {
          matched: shirtNumberSummary.processed_count,
          failed: shirtNumberSummary.failed_count,
          output_dir: normalizePath(shirtNumberSummary.output_dir),
        }
        : null,
      csv_export: csvSummary
        ? {
          strict_mode: csvSummary.strict_mode,
          output_path: csvSummary.output_path,
          rows_written: csvSummary.rows_written,
          unresolved_count: csvSummary.unresolved_count,
          conflict_count: csvSummary.conflict_count,
          validation_errors: csvSummary.validation_errors.length,
        }
        : null,
      validation: validationSummary
        ? {
          status: validationSummary.status,
          errors: validationSummary.totals.errors,
          warnings: validationSummary.totals.warnings,
          json_report: normalizePath(validationSummary.files.json_report),
          markdown_report: normalizePath(validationSummary.files.markdown_report),
        }
        : null,
    },
    items,
    files: {
      json_report: normalizePath(jsonReportPath),
      markdown_report: normalizePath(markdownReportPath),
    },
  };

  summary.status = hasBlockingFailures(summary) ? "failed" : "ok";

  writeJson(jsonReportPath, summary);
  writeFileSync(markdownReportPath, renderBatchSummaryMarkdown(summary), "utf8");

  return summary;
}

function discoverBatchSources(inputDir) {
  const entries = readdirSync(inputDir, { withFileTypes: true }).filter((entry) => entry.isFile());
  const sources = new Map();

  for (const entry of entries) {
    const absolutePath = resolve(inputDir, entry.name);
    const extension = extname(entry.name).toLowerCase();

    if (IMAGE_EXTENSIONS.has(extension)) {
      const matchId = basename(entry.name, extension);
      sources.set(matchId, {
        match_id: matchId,
        input_path: absolutePath,
        source_kind: "image",
      });
    }
  }

  for (const entry of entries) {
    const fixtureSource = toFixtureSource(inputDir, entry.name);

    if (!fixtureSource || sources.has(fixtureSource.match_id)) {
      continue;
    }

    sources.set(fixtureSource.match_id, fixtureSource);
  }

  return Array.from(sources.values()).sort((left, right) => left.match_id.localeCompare(right.match_id, "en"));
}

function toFixtureSource(inputDir, fileName) {
  if (fileName.endsWith(".ocr.json")) {
    const matchId = fileName.slice(0, -".ocr.json".length);
    return {
      match_id: matchId,
      input_path: resolve(inputDir, matchId),
      source_kind: "ocr-json-fixture",
    };
  }

  if (fileName.endsWith(".ocr.txt")) {
    const matchId = fileName.slice(0, -".ocr.txt".length);
    return {
      match_id: matchId,
      input_path: resolve(inputDir, matchId),
      source_kind: "ocr-text-fixture",
    };
  }

  if (fileName.endsWith(".left.txt")) {
    const matchId = fileName.slice(0, -".left.txt".length);
    const centerPath = resolve(inputDir, `${matchId}.center.txt`);
    const rightPath = resolve(inputDir, `${matchId}.right.txt`);

    if (existsSync(centerPath) && existsSync(rightPath)) {
      return {
        match_id: matchId,
        input_path: resolve(inputDir, matchId),
        source_kind: "ocr-zonal-fixture",
      };
    }
  }

  return null;
}

function renderBatchSummaryMarkdown(summary) {
  const lines = [
    "# Match Summary Batch Ingest Summary",
    "",
    `- Generated: ${summary.generated_at}`,
    `- Input directory: ${summary.input_dir}`,
    `- Output root: ${summary.output_root}`,
    `- Status: ${summary.status.toUpperCase()}`,
    "",
    "## Totals",
    "",
    `- Discovered: ${summary.totals.discovered}`,
    `- Succeeded: ${summary.totals.succeeded}`,
    `- Failed: ${summary.totals.failed}`,
    "",
    "## Pipeline",
    "",
    `- Formation exports: ${formatPipelineStage(summary.pipeline.formation_exports, (stage) => `${stage.exported} exported, ${stage.failed} failed` )}`,
    `- Shirt-number matching: ${formatPipelineStage(summary.pipeline.shirt_number_matching, (stage) => `${stage.matched} matched, ${stage.failed} failed`)}`,
    `- CSV export: ${formatPipelineStage(summary.pipeline.csv_export, (stage) => `${stage.rows_written} rows, ${stage.unresolved_count} unresolved, ${stage.conflict_count} conflicts`)}`,
    `- Validation: ${formatPipelineStage(summary.pipeline.validation, (stage) => `${stage.status} (${stage.errors} errors, ${stage.warnings} warnings)`)}`,
    "",
    "## Items",
    "",
  ];

  for (const item of summary.items) {
    lines.push(`### ${item.match_id}`);
    lines.push(`- Status: ${item.status}`);
    lines.push(`- Source kind: ${item.source_kind}`);
    lines.push(`- Input path: ${item.input_path}`);

    if (item.status === "success") {
    lines.push(`- Parsed artifact: ${item.files.parsed}`);
    lines.push(`- Team artifacts: ${item.files.teams.join(", ")}`);
      if (item.files.formation_exports?.length > 0) {
        lines.push(`- Formation exports: ${item.files.formation_exports.join(", ")}`);
      }

      if (item.files.shirt_number_updates?.length > 0) {
        lines.push(`- Shirt-number updates: ${item.files.shirt_number_updates.join(", ")}`);
      }
    } else {
      lines.push(`- Error: ${item.error}`);
    }

    lines.push("");
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

function indexArtifactsBySourcePath(artifacts) {
  return new Map(
    artifacts
      .filter((artifact) => artifact.source_team_artifact_path)
      .map((artifact) => [normalizePath(artifact.source_team_artifact_path), artifact]),
  );
}

function hasBlockingFailures(summary) {
  return Boolean(
    summary.totals.failed > 0 ||
      (summary.pipeline.formation_exports?.failed ?? 0) > 0 ||
      (summary.pipeline.shirt_number_matching?.failed ?? 0) > 0 ||
      (summary.pipeline.csv_export?.validation_errors ?? 0) > 0 ||
      (summary.pipeline.validation?.errors ?? 0) > 0 ||
      (strictCsvFailure(summary.pipeline.csv_export) ?? false),
  );
}

function strictCsvFailure(csvExport) {
  if (!csvExport || !csvExport.strict_mode) {
    return false;
  }

  return csvExport.unresolved_count > 0 || csvExport.conflict_count > 0;
}

function formatPipelineStage(stage, formatter) {
  if (!stage) {
    return "not-run";
  }

  return formatter(stage);
}

function printHelp() {
  console.log(`Usage: node scripts/batch-ingest-match-summaries.mjs [--input-dir sources/match-summaries] [--output-root generated/match-summary-ingest] [--roster-fixture-dir <dir>] [--write-canonical-formations] [--strict-csv]

Processes every supported screenshot or OCR fixture through the safe pipeline:
ingest -> split -> staged formation export -> shirt-number matching -> CSV export -> validation.
By default image inputs run through local tesseract.js OCR and all derived artifacts stay under --output-root.
Set MATCH_SUMMARY_OCR_PROVIDER=fixture to force sibling OCR fixtures during debugging. Use --write-canonical-formations to also mirror formation inputs into samples/teams.`);
}
