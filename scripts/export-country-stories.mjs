#!/usr/bin/env node

import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  chunk,
  fetchJson,
  getOptionValue,
  getQualifiedTeams,
  slugifyName,
} from "./lib/qualified-countries.mjs";

const EN_WIKIPEDIA_API = "https://en.wikipedia.org/w/api.php";
const ES_WIKIPEDIA_API = "https://es.wikipedia.org/w/api.php";
const DEFAULT_OUTPUT_PATH = "generated/country-stories-import.csv";
const CSV_COLUMNS = ["slug", "name", "story"];
const MANUAL_SPANISH_TITLE_BY_ENGLISH_TITLE = new Map();

const argv = process.argv.slice(2);
const outputPath = resolve(process.cwd(), getOptionValue(argv, "--output") ?? DEFAULT_OUTPUT_PATH);

try {
  const teams = await getQualifiedTeams();
  const spanishTitleByEnglishTitle = await resolveSpanishTitles(teams);
  const records = await buildStoryRecords(teams, spanishTitleByEnglishTitle);

  writeStoriesCsv(records, outputPath);
  printSummary(records, outputPath);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

async function resolveSpanishTitles(teams) {
  const spanishTitleByEnglishTitle = new Map();

  for (const batch of chunk(teams, 25)) {
    const url = new URL(EN_WIKIPEDIA_API);
    url.search = new URLSearchParams({
      action: "query",
      prop: "langlinks",
      titles: batch.map((team) => team.wikipedia_title).join("|"),
      lllang: "es",
      lllimit: "max",
      redirects: "1",
      format: "json",
      origin: "*",
    }).toString();

    const json = await fetchJson(url);

    for (const page of Object.values(json.query?.pages ?? {})) {
      if (!page?.title) continue;

      const manualTitle = MANUAL_SPANISH_TITLE_BY_ENGLISH_TITLE.get(page.title);
      const spanishTitle = manualTitle ?? page.langlinks?.find((link) => link.lang === "es")?.["*"];

      if (spanishTitle) {
        spanishTitleByEnglishTitle.set(page.title, spanishTitle);
      }
    }
  }

  return spanishTitleByEnglishTitle;
}

async function buildStoryRecords(teams, spanishTitleByEnglishTitle) {
  const spanishTitles = teams
    .map((team) => spanishTitleByEnglishTitle.get(team.wikipedia_title) ?? MANUAL_SPANISH_TITLE_BY_ENGLISH_TITLE.get(team.wikipedia_title) ?? null);
  const storyBySpanishTitle = await fetchSpanishLeadTexts(spanishTitles.filter(Boolean));
  const records = [];

  for (const team of teams) {
    const spanishTitle =
      spanishTitleByEnglishTitle.get(team.wikipedia_title) ??
      MANUAL_SPANISH_TITLE_BY_ENGLISH_TITLE.get(team.wikipedia_title) ??
      null;
    const story = spanishTitle ? (storyBySpanishTitle.get(spanishTitle) ?? "") : "";

    records.push({
      slug: slugifyName(team.name),
      name: team.name,
      story,
      wikipedia_title_es: spanishTitle,
    });
  }

  return records;
}

async function fetchSpanishLeadTexts(titles) {
  const storyByTitle = new Map();
  const uniqueTitles = Array.from(new Set(titles));

  for (const batch of chunk(uniqueTitles, 20)) {
    const url = new URL(ES_WIKIPEDIA_API);
    url.search = new URLSearchParams({
      action: "query",
      prop: "extracts",
      titles: batch.join("|"),
      redirects: "1",
      exintro: "1",
      explaintext: "1",
      format: "json",
      formatversion: "2",
      origin: "*",
    }).toString();

    const json = await fetchJson(url);
    const pageByTitle = new Map((json.query?.pages ?? []).map((page) => [page.title, page]));

    for (const requestedTitle of batch) {
      const resolvedTitle = resolveRequestedTitle(json, requestedTitle);
      const page = pageByTitle.get(resolvedTitle);
      storyByTitle.set(requestedTitle, cleanLeadText(page?.extract ?? ""));
    }
  }

  return storyByTitle;
}

function resolveRequestedTitle(json, requestedTitle) {
  const normalizedTitle = json.query?.normalized?.find((item) => item.from === requestedTitle)?.to ?? requestedTitle;
  return json.query?.redirects?.find((item) => item.from === normalizedTitle)?.to ?? normalizedTitle;
}

function cleanLeadText(value) {
  const normalized = String(value ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/\[(?:\d+|nota\s*\d*|cita requerida)\]/gi, "")
    .trim();

  if (!normalized) return "";

  const paragraphs = normalized
    .split(/\n\s*\n+/)
    .map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  return paragraphs.join("\n\n");
}

function writeStoriesCsv(records, filePath) {
  const csv = toCsv(records, CSV_COLUMNS);
  const parentDirectory = resolve(filePath, "..");

  mkdirSync(parentDirectory, { recursive: true });
  writeFileSync(filePath, csv, "utf8");
}

function toCsv(rows, columns) {
  const header = columns.join(",");
  const lines = rows.map((row) => columns.map((column) => escapeCsvValue(row[column])).join(","));
  return `${header}\n${lines.join("\n")}\n`;
}

function escapeCsvValue(value) {
  const text = String(value ?? "");

  if (!/[",\n\r]/.test(text)) return text;

  return `"${text.replaceAll('"', '""')}"`;
}

function printSummary(records, filePath) {
  const missingStories = records.filter((record) => !record.story).map((record) => record.name);

  console.log(`CSV export complete: ${records.length} qualified teams processed.`);
  console.log(`CSV written to ${filePath}`);
  console.table(
    records.map((record) => ({
      slug: record.slug,
      name: record.name,
      story: record.story ? "yes" : "missing",
      source: record.wikipedia_title_es ?? "manual",
    })),
  );

  if (missingStories.length > 0) {
    console.log(`Manual story follow-up: ${missingStories.join(", ")}`);
  }
}
