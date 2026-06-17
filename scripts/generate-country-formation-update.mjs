#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createCountryFormationUpdate } from "./lib/formation-svg.mjs";

const argv = process.argv.slice(2);
const inputPath = resolve(process.cwd(), getOptionValue(argv, "--input") ?? "generated/country-formation-mexico-input.json");

try {
  const rawInput = readFileSync(inputPath, "utf8");
  const formationInput = JSON.parse(rawInput);
  const updatePayload = createCountryFormationUpdate(formationInput);
  const outputStem = getOutputStem(updatePayload.country);
  const outputDir = resolve(process.cwd(), getOptionValue(argv, "--output-dir") ?? "generated");
  const jsonOutputPath = resolve(
    process.cwd(),
    getOptionValue(argv, "--json-output") ?? `${outputDir}/${outputStem}.json`,
  );
  const svgOutputPath = resolve(
    process.cwd(),
    getOptionValue(argv, "--svg-output") ?? `${outputDir}/${outputStem}.svg`,
  );
  const sqlOutputPath = resolve(
    process.cwd(),
    getOptionValue(argv, "--sql-output") ?? `${outputDir}/${outputStem}.sql`,
  );

  mkdirSync(dirname(jsonOutputPath), { recursive: true });
  mkdirSync(dirname(svgOutputPath), { recursive: true });
  mkdirSync(dirname(sqlOutputPath), { recursive: true });

  writeFileSync(jsonOutputPath, `${JSON.stringify(updatePayload, null, 2)}\n`, "utf8");
  writeFileSync(svgOutputPath, `${updatePayload.formationSvg}\n`, "utf8");
  writeFileSync(sqlOutputPath, `${updatePayload.sql}\n`, "utf8");

  console.log(`Country formation payload written to ${jsonOutputPath}`);
  console.log(`Formation SVG written to ${svgOutputPath}`);
  console.log(`Country update SQL written to ${sqlOutputPath}`);
  console.log(`Ready to update ${updatePayload.country.slug ?? updatePayload.country.name} (${updatePayload.document.team.formation}).`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

function getOutputStem(country) {
  return `${slugify(country.slug ?? country.name ?? "country")}-formation-update`;
}

function slugify(value) {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "country";
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
