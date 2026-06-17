#!/usr/bin/env node

import { createClient } from "@supabase/supabase-js";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  decodeHtml,
  fetchJson,
  fetchWikipediaHtml,
  getOptionValue,
  getQualifiedTeams,
  normalizeName,
  sleep,
} from "./lib/qualified-countries.mjs";

const WIKIPEDIA_API = "https://en.wikipedia.org/w/api.php";
const DEFAULT_OUTPUT_PATH = "generated/countries-import.csv";
const CSV_COLUMNS = ["name", "federation", "flag_url", "emblem_url"];

const argv = process.argv.slice(2);
const args = new Set(argv);
const dryRun = args.has("--dry-run");
const overwriteMedia = args.has("--overwrite-media");
const skipEmblems = args.has("--skip-emblems");
const shallowEmblems = args.has("--shallow-emblems");
const writeMode = args.has("--write");
const csvMode = args.has("--csv") || !writeMode;
const outputPath = resolve(process.cwd(), getOptionValue(argv, "--output") ?? DEFAULT_OUTPUT_PATH);

if (writeMode && args.has("--csv")) {
  throw new Error("Choose either --write or --csv, not both.");
}

loadEnvFile(".env.local");
loadEnvFile(".env");

try {
  const teams = await getQualifiedTeams();
  const records = skipEmblems ? teams : await withBestEffortEmblems(teams);

  if (dryRun) {
    printPlan(records, { dryRun: true, mode: writeMode ? "write" : "csv", outputPath });
    process.exit(0);
  }

  if (csvMode) {
    writeCountriesCsv(records, outputPath);
    printPlan(records, { dryRun: false, mode: "csv", outputPath });
    process.exit(0);
  }

  const supabase = createSupabaseClient();
  const result = await writeCountries(supabase, records);

  printPlan(records, { dryRun: false, mode: "write", result, outputPath });
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

function loadEnvFile(fileName) {
  const path = resolve(process.cwd(), fileName);

  if (!existsSync(path)) return;

  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;

    const key = trimmed.slice(0, separator).trim();
    const rawValue = trimmed.slice(separator + 1).trim();

    if (!key || process.env[key]) continue;

    process.env[key] = rawValue.replace(/^['"]|['"]$/g, "");
  }
}

async function withBestEffortEmblems(teams) {
  const emblemByTitle = await findTeamEmblemsFromPageImages(teams);
  const enriched = teams.map((team) => ({
    ...team,
    emblem_url: emblemByTitle.get(team.wikipedia_title) ?? null,
  }));

  if (shallowEmblems) return enriched;

  for (const team of enriched) {
    if (team.emblem_url) continue;

    team.emblem_url = await findTeamEmblemFromInfobox(team);
    await sleep(500);
  }

  return enriched;
}

async function findTeamEmblemsFromPageImages(teams) {
  const emblemByTitle = new Map();
  const titles = teams.map((team) => team.wikipedia_title);

  for (const batch of chunk(titles, 45)) {
    const url = new URL(WIKIPEDIA_API);
    url.search = new URLSearchParams({
      action: "query",
      titles: batch.join("|"),
      prop: "pageimages",
      piprop: "original|name",
      format: "json",
      origin: "*",
    }).toString();

    const json = await fetchJson(url);

    for (const page of Object.values(json.query?.pages ?? {})) {
      const emblemUrl = page?.original?.source ?? null;
      const imageName = page?.pageimage ?? emblemUrl ?? "";

      if (!page?.title || !emblemUrl || !isLikelyEmblem(imageName)) continue;

      emblemByTitle.set(page.title, toOriginalWikimediaUrl(emblemUrl));
    }
  }

  const missingTeams = teams.filter((team) => !emblemByTitle.has(team.wikipedia_title));
  const imageListEmblems = await findTeamEmblemsFromImageLists(missingTeams);

  for (const [title, emblemUrl] of imageListEmblems) {
    emblemByTitle.set(title, emblemUrl);
  }

  return emblemByTitle;
}

async function findTeamEmblemsFromImageLists(teams) {
  const candidateFileByTitle = new Map();

  for (const batch of chunk(teams, 45)) {
    const url = new URL(WIKIPEDIA_API);
    url.search = new URLSearchParams({
      action: "query",
      titles: batch.map((team) => team.wikipedia_title).join("|"),
      prop: "images",
      imlimit: "max",
      format: "json",
      origin: "*",
    }).toString();

    const json = await fetchJson(url);

    for (const page of Object.values(json.query?.pages ?? {})) {
      if (!page?.title || candidateFileByTitle.has(page.title)) continue;

      const file = page.images?.find((image) => isLikelyEmblemFile(image.title, page.title));
      if (file?.title) candidateFileByTitle.set(page.title, file.title);
    }
  }

  const fileUrlByTitle = await getImageInfoUrls(Array.from(candidateFileByTitle.values()));
  const emblemByTitle = new Map();

  for (const [pageTitle, fileTitle] of candidateFileByTitle) {
    const emblemUrl = fileUrlByTitle.get(fileTitle);
    if (emblemUrl) emblemByTitle.set(pageTitle, emblemUrl);
  }

  return emblemByTitle;
}

async function getImageInfoUrls(fileTitles) {
  const urlByTitle = new Map();

  for (const batch of chunk(fileTitles, 45)) {
    if (batch.length === 0) continue;

    const url = new URL(WIKIPEDIA_API);
    url.search = new URLSearchParams({
      action: "query",
      titles: batch.join("|"),
      prop: "imageinfo",
      iiprop: "url",
      format: "json",
      origin: "*",
    }).toString();

    const json = await fetchJson(url);

    for (const page of Object.values(json.query?.pages ?? {})) {
      const imageUrl = page?.imageinfo?.[0]?.url;
      if (page?.title && imageUrl) urlByTitle.set(page.title, toOriginalWikimediaUrl(imageUrl));
    }
  }

  return urlByTitle;
}

async function findTeamEmblemFromInfobox(team) {
  try {
    const page = team.team_page.split("/wiki/")[1];
    const html = await fetchWikipediaHtml(decodeURIComponent(page), 0);
    const infobox = html.match(/<table[^>]*class="[^"]*infobox[^"]*"[\s\S]*?<\/table>/)?.[0];

    if (!infobox) return null;

    const imageLinks = infobox.matchAll(
      /<a\s+href="\/wiki\/File:([^"]+)"[^>]*?(?:title="([^"]*)")?[^>]*>[\s\S]*?<img[^>]+src="([^"]+)"[^>]*(?:alt="([^"]*)")?[^>]*>/g,
    );

    for (const [, fileName, linkTitle = "", src, alt = ""] of imageLinks) {
      const label = decodeHtml(`${fileName} ${linkTitle} ${alt}`).toLowerCase();

      if (!isLikelyEmblem(label)) continue;

      return toOriginalWikimediaUrl(src);
    }
  } catch (error) {
    console.warn(`Could not resolve emblem for ${team.name}: ${formatError(error)}`);
  }

  return null;
}

function isLikelyEmblem(label) {
  if (isGenericMediaAsset(label)) return false;
  if (isPhotoLikeAsset(label)) return false;
  if (/(flag|kit|jersey|shirt\s+colors|map|stadium)/i.test(label)) return false;
  return /(logo|crest|badge|association|federation|football|soccer)/i.test(label);
}

function isLikelyEmblemFile(fileTitle, pageTitle) {
  const label = decodeHtml(fileTitle).toLowerCase();
  const countryToken = pageTitle
    .replace(/(?:men's|national|association|football|soccer|team)/gi, " ")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .split(/\s+/)[0]
    ?.toLowerCase();

  if (/(flag|kit|jersey|shirt\s+colors|map|stadium|soccerball|football\s+pitch)/i.test(label)) {
    return false;
  }

  if (isGenericMediaAsset(label)) return false;
  if (isPhotoLikeAsset(label)) return false;

  if (/(logo|crest|badge|association|federation)/i.test(label)) return true;

  return Boolean(
    countryToken &&
      label.includes(countryToken) &&
      hasPreferredEmblemExtension(label) &&
      /(football|soccer)/i.test(label),
  );
}

function isGenericMediaAsset(label) {
  return /(commons-logo|wikimedia|wikipedia-logo|wiki(?:pedia|media)\s*commons)/i.test(label);
}

function isPhotoLikeAsset(label) {
  return /\.(?:jpe?g|webp)$/i.test(label) || /(champion|celebration|players?|squad|training|matchday|lineup|trophy|cup)/i.test(label);
}

function hasPreferredEmblemExtension(label) {
  return /\.(?:svg|png)$/i.test(label);
}

function createSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_COUNTRY_IMPORT_KEY ??
    process.env.SUPABASE_SECRET_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL.");
  }

  if (!key) {
    throw new Error(
      "Missing Supabase write key. Set SUPABASE_COUNTRY_IMPORT_KEY, SUPABASE_SECRET_KEY, SUPABASE_SERVICE_ROLE_KEY, or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, or run the script without --write to export CSV instead.",
    );
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
    global: {
      headers: {
        "X-Client-Info": "wc26-country-importer",
      },
    },
  });
}

async function writeCountries(supabase, records) {
  const { data: existingCountries, error: readError } = await supabase
    .from("country")
    .select("id,name,federation,flag_url,emblem_url");

  if (readError) throw new Error(`Could not read country rows: ${readError.message}`);

  const existingByName = new Map(
    (existingCountries ?? []).map((country) => [normalizeName(country.name), country]),
  );
  const inserts = [];
  const updates = [];

  for (const record of records) {
    const existing = existingByName.get(normalizeName(record.name));
    const row = toCountryRow(record);

    if (!existing) {
      inserts.push(row);
      continue;
    }

    const update = changedFields(existing, row);

    if (Object.keys(update).length > 0) {
      updates.push({ id: existing.id, update });
    }
  }

  if (inserts.length > 0) {
    const { error } = await supabase.from("country").insert(inserts);
    if (error) throw new Error(`Could not insert country rows: ${error.message}`);
  }

  for (const { id, update } of updates) {
    const { error } = await supabase.from("country").update(update).eq("id", id);
    if (error) throw new Error(`Could not update country ${id}: ${error.message}`);
  }

  return {
    inserted: inserts.length,
    updated: updates.length,
    unchanged: records.length - inserts.length - updates.length,
  };
}

function writeCountriesCsv(records, filePath) {
  const csv = toCsv(records.map((record) => toCountryRow(record)), CSV_COLUMNS);
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
  const normalized = normalizeNullable(value) ?? "";
  const text = String(normalized);

  if (!/[",\n\r]/.test(text)) return text;

  return `"${text.replaceAll('"', '""')}"`;
}

function toCountryRow(record) {
  return {
    name: record.name,
    federation: record.federation,
    flag_url: record.flag_url,
    emblem_url: record.emblem_url,
  };
}

function changedFields(existing, next) {
  const update = {};

  for (const key of ["federation", "flag_url", "emblem_url"]) {
    const existingValue = normalizeNullable(existing[key]);
    const nextValue = normalizeNullable(next[key]);

    if (!nextValue) continue;
    if (!overwriteMedia && existingValue) continue;
    if (existingValue !== nextValue) update[key] = nextValue;
  }

  return update;
}

function printPlan(records, { dryRun, mode, result, outputPath }) {
  const missingFlags = records.filter((record) => !record.flag_url).map((record) => record.name);
  const missingEmblems = records.filter((record) => !record.emblem_url).map((record) => record.name);

  const actionLabel =
    mode === "write"
      ? dryRun
        ? "Dry run"
        : "Import complete"
      : dryRun
        ? "Dry run"
        : "CSV export complete";

  console.log(`${actionLabel}: ${records.length} qualified teams parsed.`);

  if (result) {
    console.log(
      `Inserted: ${result.inserted}; updated: ${result.updated}; unchanged: ${result.unchanged}.`,
    );
  }

  if (mode === "csv" && !dryRun) {
    console.log(`CSV written to ${outputPath}`);
  }

  console.table(
    records.map((record) => ({
      name: record.name,
      federation: record.federation,
      flag: record.flag_url ? "yes" : "missing",
      emblem: record.emblem_url ? "yes" : "manual",
    })),
  );

  if (missingFlags.length > 0) {
    console.log(`Manual flag follow-up: ${missingFlags.join(", ")}`);
  }

  if (missingEmblems.length > 0) {
    console.log(`Manual emblem follow-up: ${missingEmblems.join(", ")}`);
  }
}

function toOriginalWikimediaUrl(src) {
  if (!src) return null;

  const absoluteUrl = decodeHtml(src).startsWith("//")
    ? `https:${decodeHtml(src)}`
    : decodeHtml(src);
  const withoutThumb = absoluteUrl.replace(
    /\/wikipedia\/([^/]+)\/thumb\/([^/]+)\/([^/]+)\/[^/]+$/,
    "/wikipedia/$1/$2/$3",
  );

  return withoutThumb.replace(/ /g, "_");
}

function chunk(items, size) {
  const chunks = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

function normalizeNullable(value) {
  if (typeof value !== "string") return value ?? null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function formatError(error) {
  return error instanceof Error ? error.message : String(error);
}
