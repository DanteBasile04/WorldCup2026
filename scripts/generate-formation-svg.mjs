#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createFormationDocument, renderFormationSvg } from "./lib/formation-svg.mjs";

const argv = process.argv.slice(2);
const inputPath = resolve(process.cwd(), getOptionValue(argv, "--input") ?? "generated/formation-mexico-input.json");
const svgOutputValue = getOptionValue(argv, "--svg-output");
const jsonOutputValue = getOptionValue(argv, "--json-output");
const svgOutputPath = svgOutputValue ? resolve(process.cwd(), svgOutputValue) : null;
const jsonOutputPath = jsonOutputValue ? resolve(process.cwd(), jsonOutputValue) : null;
const printToStdout = argv.includes("--stdout") || !svgOutputPath;

try {
  const rawInput = readFileSync(inputPath, "utf8");
  const formationInput = JSON.parse(rawInput);
  const document = createFormationDocument(formationInput);
  const svg = renderFormationSvg(document);

  if (jsonOutputPath) {
    mkdirSync(dirname(jsonOutputPath), { recursive: true });
    writeFileSync(jsonOutputPath, `${JSON.stringify(document, null, 2)}\n`, "utf8");
  }

  if (svgOutputPath) {
    mkdirSync(dirname(svgOutputPath), { recursive: true });
    writeFileSync(svgOutputPath, `${svg}\n`, "utf8");
  }

  if (printToStdout) {
    process.stdout.write(svg);
    if (!svg.endsWith("\n")) process.stdout.write("\n");
  } else {
    console.log(`Formation SVG ready for storage (${svg.length} chars).`);
  }

  if (jsonOutputPath) console.log(`Normalized formation JSON written to ${jsonOutputPath}`);
  if (svgOutputPath) console.log(`Formation SVG written to ${svgOutputPath}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

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
