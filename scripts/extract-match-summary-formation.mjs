#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  buildFormationInputFromText,
  MEXICO_MATCH_SUMMARY_EXAMPLE,
} from "./lib/match-summary-formation.mjs";
import { createFormationDocument, renderFormationSvg } from "./lib/formation-svg.mjs";

const argv = process.argv.slice(2);
const outputDirArg = getOptionValue(argv, "--output-dir") ?? "generated";
const outputDir = resolve(process.cwd(), outputDirArg);
const jsonOutputPath = resolve(
  process.cwd(),
  getOptionValue(argv, "--json-output") ?? `${outputDirArg}/formation-mexico-example.json`,
);
const svgOutputPath = resolve(
  process.cwd(),
  getOptionValue(argv, "--svg-output") ?? `${outputDirArg}/formation-mexico-example.svg`,
);
const lineupFilePath = getOptionValue(argv, "--lineup-file");

try {
  const lineupText = lineupFilePath
    ? readFileSync(resolve(process.cwd(), lineupFilePath), "utf8")
    : MEXICO_MATCH_SUMMARY_EXAMPLE.lineupText;
  const formationInput = buildFormationInputFromText({
    ...MEXICO_MATCH_SUMMARY_EXAMPLE,
    lineupText,
  });
  const formationExample = createFormationDocument(formationInput);
  const svg = renderFormationSvg(formationExample);

  mkdirSync(outputDir, { recursive: true });
  mkdirSync(dirname(jsonOutputPath), { recursive: true });
  mkdirSync(dirname(svgOutputPath), { recursive: true });
  writeFileSync(jsonOutputPath, `${JSON.stringify(formationExample, null, 2)}\n`, "utf8");
  writeFileSync(svgOutputPath, svg, "utf8");

  console.log(`Formation JSON written to ${jsonOutputPath}`);
  console.log(`Formation SVG written to ${svgOutputPath}`);
  console.log(
    `Parsed ${formationExample.players.length} starters for ${formationExample.team.name} (${formationExample.team.formation}) from a match summary source.`,
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

function getOptionValue(args, optionName) {
  const directMatch = args.find((value) => value.startsWith(`${optionName}=`));

  if (directMatch) {
    return directMatch.slice(optionName.length + 1).trim();
  }

  const index = args.indexOf(optionName);

  if (index === -1) return null;

  const value = args[index + 1];

  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value for ${optionName}.`);
  }

  return value;
}
