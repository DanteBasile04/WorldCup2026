#!/usr/bin/env node

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { writeJson } from "./lib/fbref-player-export.mjs";
import {
  renderValidationSummaryMarkdown,
  validateIngestionTree,
} from "./lib/match-summary-validator.mjs";
import { getOptionValue } from "./lib/qualified-countries.mjs";

if (isDirectExecution()) {
  const argv = process.argv.slice(2);

  if (argv.includes("--help") || argv.includes("-h")) {
    printHelp();
    process.exit(0);
  }

  const inputDir = getOptionValue(argv, "--input-dir") ?? "generated/match-summary-ingest";

  try {
    const summary = runValidateMatchSummaryIngest({ inputDir });

    console.log(`Validation JSON written to ${summary.files.json_report}`);
    console.log(`Validation Markdown written to ${summary.files.markdown_report}`);
    console.log(
      `Validation status: ${summary.status.toUpperCase()} (${summary.totals.errors} errors, ${summary.totals.warnings} warnings).`,
    );

    if (summary.totals.errors > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

export function runValidateMatchSummaryIngest({ inputDir }) {
  const resolvedInputDir = resolve(process.cwd(), inputDir);
  const summary = validateIngestionTree({ inputDir: resolvedInputDir });
  const reportsDir = resolve(resolvedInputDir, "reports");
  const jsonOutputPath = resolve(reportsDir, "validation-summary.json");
  const markdownOutputPath = resolve(reportsDir, "validation-summary.md");

  writeJson(jsonOutputPath, summary);
  writeFileSync(markdownOutputPath, renderValidationSummaryMarkdown(summary), "utf8");

  return {
    ...summary,
    files: {
      json_report: jsonOutputPath,
      markdown_report: markdownOutputPath,
    },
  };
}

function printHelp() {
  console.log(`Usage: node scripts/validate-match-summary-ingest.mjs [--input-dir generated/match-summary-ingest]

Scans parsed, team, staged formation-export, and shirt-number artifacts under the generated ingest tree and writes:
- reports/validation-summary.json
- reports/validation-summary.md`);
}

function isDirectExecution() {
  return process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false;
}
