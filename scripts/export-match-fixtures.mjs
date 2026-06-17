#!/usr/bin/env node

import { createClient } from "@supabase/supabase-js";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { getOptionValue, normalizeName } from "./lib/qualified-countries.mjs";

const FIFA_MATCHES_URL = "https://api.fifa.com/api/v3/calendar/matches?language=en&count=500&idSeason=285023";
const CUTOFF_MATCH_ID = "400021495";
const CUTOFF_MATCH_DATE = "2026-06-28T02:00:00Z";
const DEFAULT_OUTPUT_PATH = "generated/public-match-import.csv";
const CSV_COLUMNS = [
  "group_id",
  "local_country_id",
  "away_country_id",
  "next_match_id",
  "phase",
  "round",
  "stage",
  "stadium",
  "date",
  "local_score",
  "away_score",
  "status",
];
const OPTIONAL_COLUMNS = ["next_match_id", "round", "stage", "stadium", "date", "local_score", "away_score"];
const COUNTRY_ALIASES = new Map([
  ["Cabo Verde", "Cape Verde"],
  ["Congo DR", "DR Congo"],
  ["Côte d'Ivoire", "Ivory Coast"],
  ["Czechia", "Czech Republic"],
  ["IR Iran", "Iran"],
  ["Korea Republic", "South Korea"],
  ["Türkiye", "Turkey"],
  ["USA", "United States"],
]);

const argv = process.argv.slice(2);
const outputPath = resolve(process.cwd(), getOptionValue(argv, "--output") ?? DEFAULT_OUTPUT_PATH);

loadEnvFile(".env.local");
loadEnvFile(".env");

try {
  const supabase = createSupabaseClient();
  const [matches, referenceData] = await Promise.all([fetchFifaMatches(), readReferenceData(supabase)]);
  const fixtures = filterFixturesThroughCutoff(matches);
  const exportResult = buildExport(fixtures, referenceData);

  assertImportable(exportResult);
  writeCsv(exportResult.rows, outputPath);
  printSummary(exportResult, outputPath);
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

function createSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.SUPABASE_COUNTRY_IMPORT_KEY ??
    process.env.SUPABASE_SECRET_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL.");
  }

  if (!key) {
    throw new Error(
      "Missing Supabase key. Set NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, SUPABASE_COUNTRY_IMPORT_KEY, SUPABASE_SECRET_KEY, or SUPABASE_SERVICE_ROLE_KEY.",
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
        "X-Client-Info": "wc26-match-exporter",
      },
    },
  });
}

async function fetchFifaMatches() {
  const response = await fetch(FIFA_MATCHES_URL, {
    headers: {
      "User-Agent": "wc26-match-exporter/1.0",
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`FIFA matches request failed: ${response.status} ${response.statusText}`);
  }

  const payload = await response.json();

  if (!Array.isArray(payload?.Results)) {
    throw new Error("FIFA matches response did not include a Results array.");
  }

  return payload.Results;
}

async function readReferenceData(supabase) {
  const [countriesResponse, groupsResponse] = await Promise.all([
    supabase.from("country").select("id,name,slug").order("id", { ascending: true }),
    supabase.from("grp").select("id,name,slug").order("id", { ascending: true }),
  ]);

  if (countriesResponse.error) {
    throw new Error(`Could not read public.country: ${countriesResponse.error.message}`);
  }

  if (groupsResponse.error) {
    throw new Error(`Could not read public.grp: ${groupsResponse.error.message}`);
  }

  return {
    countries: countriesResponse.data ?? [],
    groups: groupsResponse.data ?? [],
    countryByName: new Map((countriesResponse.data ?? []).map((country) => [normalizeName(country.name), country])),
    groupByName: new Map((groupsResponse.data ?? []).map((group) => [normalizeName(group.name), group])),
  };
}

function filterFixturesThroughCutoff(matches) {
  const target = matches.find((match) => String(match.IdMatch) === CUTOFF_MATCH_ID);

  if (!target) {
    throw new Error(`Could not find cutoff match ${CUTOFF_MATCH_ID} in the FIFA response.`);
  }

  if (target.Date !== CUTOFF_MATCH_DATE) {
    throw new Error(
      `Cutoff match ${CUTOFF_MATCH_ID} date mismatch. Expected ${CUTOFF_MATCH_DATE}, received ${target.Date ?? "<missing>"}.`,
    );
  }

  const cutoffTime = Date.parse(CUTOFF_MATCH_DATE);

  return matches
    .filter((match) => match.Date && Date.parse(match.Date) <= cutoffTime)
    .sort((left, right) => Date.parse(left.Date) - Date.parse(right.Date) || Number(left.MatchNumber ?? 0) - Number(right.MatchNumber ?? 0));
}

function buildExport(fixtures, referenceData) {
  const rows = [];
  const unresolvedCountries = [];
  const unresolvedGroups = [];
  const aliasMatches = new Set();
  const statusCounts = new Map();

  for (const fixture of fixtures) {
    const groupName = getLocalizedDescription(fixture.GroupName);
    const homeName = getLocalizedDescription(fixture.Home?.TeamName);
    const awayName = getLocalizedDescription(fixture.Away?.TeamName);
    const group = resolveGroup(groupName, referenceData.groupByName);
    const home = resolveCountry(homeName, referenceData.countryByName);
    const away = resolveCountry(awayName, referenceData.countryByName);
    const status = toMatchStatus(fixture.MatchStatus);

    if (!group.match && groupName) {
      unresolvedGroups.push(groupName);
    }

    if (!home.match && homeName) {
      unresolvedCountries.push(homeName);
    }

    if (!away.match && awayName) {
      unresolvedCountries.push(awayName);
    }

    if (home.aliasUsed) aliasMatches.add(`${homeName} -> ${home.aliasUsed}`);
    if (away.aliasUsed) aliasMatches.add(`${awayName} -> ${away.aliasUsed}`);

    statusCounts.set(status, (statusCounts.get(status) ?? 0) + 1);

    rows.push({
      group_id: group.match?.id ?? "",
      local_country_id: home.match?.id ?? "",
      away_country_id: away.match?.id ?? "",
      next_match_id: "",
      phase: derivePhase(groupName),
      round: "",
      stage: "",
      stadium: getLocalizedDescription(fixture.Stadium?.Name) ?? "",
      date: fixture.Date ?? "",
      local_score: shouldIncludeScore(status) ? normalizeNullableNumber(fixture.HomeTeamScore) ?? "" : "",
      away_score: shouldIncludeScore(status) ? normalizeNullableNumber(fixture.AwayTeamScore) ?? "" : "",
      status,
    });
  }

  return {
    rows,
    blankOptionalCounts: countBlankOptionalFields(rows),
    unresolvedCountries: dedupe(unresolvedCountries),
    unresolvedGroups: dedupe(unresolvedGroups),
    resolvedAliasMismatches: Array.from(aliasMatches).sort((left, right) => left.localeCompare(right, "en")),
    statusCounts: Object.fromEntries(Array.from(statusCounts.entries()).sort(([left], [right]) => left.localeCompare(right, "en"))),
    cutoffRowIncluded: rows.some(
      (row) => row.group_id === 10 && row.local_country_id === 26 && row.away_country_id === 2 && row.date === CUTOFF_MATCH_DATE,
    ),
  };
}

function assertImportable(exportResult) {
  if (exportResult.unresolvedCountries.length > 0) {
    throw new Error(
      `Unresolved country mappings: ${exportResult.unresolvedCountries.join(", ")}. Refusing to write a risky CSV with broken country FKs.`,
    );
  }

  if (exportResult.unresolvedGroups.length > 0) {
    throw new Error(
      `Unresolved group mappings: ${exportResult.unresolvedGroups.join(", ")}. Refusing to write a risky CSV with broken group FKs.`,
    );
  }

  if (!exportResult.cutoffRowIncluded) {
    throw new Error(`Verification failed: cutoff fixture ${CUTOFF_MATCH_ID} was not included in the export rows.`);
  }
}

function resolveCountry(name, countryByName) {
  if (!name) return { match: null, aliasUsed: null };

  const directMatch = countryByName.get(normalizeName(name)) ?? null;
  if (directMatch) return { match: directMatch, aliasUsed: null };

  const alias = COUNTRY_ALIASES.get(name);
  if (!alias) return { match: null, aliasUsed: null };

  return {
    match: countryByName.get(normalizeName(alias)) ?? null,
    aliasUsed: alias,
  };
}

function resolveGroup(name, groupByName) {
  if (!name) return { match: null };
  return { match: groupByName.get(normalizeName(name)) ?? null };
}

function derivePhase(groupName) {
  return groupName?.startsWith("Group ") ? "group" : "knockout";
}

function toMatchStatus(matchStatus) {
  if (matchStatus === 0) return "finished";
  if (matchStatus === 1) return "scheduled";
  if (matchStatus === 3) return "live";

  throw new Error(`Unsupported FIFA MatchStatus value: ${String(matchStatus)}`);
}

function shouldIncludeScore(status) {
  return status === "finished" || status === "live";
}

function normalizeNullableNumber(value) {
  return Number.isFinite(value) ? value : null;
}

function getLocalizedDescription(values) {
  return values?.find((value) => typeof value?.Description === "string")?.Description ?? null;
}

function countBlankOptionalFields(rows) {
  return Object.fromEntries(
    OPTIONAL_COLUMNS.map((column) => [
      column,
      rows.reduce((count, row) => count + (row[column] === "" ? 1 : 0), 0),
    ]),
  );
}

function writeCsv(rows, filePath) {
  const parentDirectory = resolve(filePath, "..");
  mkdirSync(parentDirectory, { recursive: true });
  writeFileSync(filePath, toCsv(rows, CSV_COLUMNS), "utf8");
}

function toCsv(rows, columns) {
  const header = columns.join(",");
  const lines = rows.map((row) => columns.map((column) => escapeCsvValue(row[column])).join(","));
  return `${header}\n${lines.join("\n")}\n`;
}

function escapeCsvValue(value) {
  const normalized = value ?? "";
  const text = String(normalized);

  if (!/[",\n\r]/.test(text)) return text;

  return `"${text.replaceAll('"', '""')}"`;
}

function dedupe(values) {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right, "en"));
}

function printSummary(exportResult, filePath) {
  console.log(`CSV export complete: ${exportResult.rows.length} rows written.`);
  console.log(`Cutoff fixture included: ${exportResult.cutoffRowIncluded ? "yes" : "no"} (${CUTOFF_MATCH_ID}).`);
  console.log(`Statuses: ${JSON.stringify(exportResult.statusCounts)}.`);
  console.log(
    `Resolved alias mismatches: ${exportResult.resolvedAliasMismatches.length > 0 ? exportResult.resolvedAliasMismatches.join("; ") : "none"}.`,
  );
  console.log(
    `Unresolved aliases: ${exportResult.unresolvedCountries.length > 0 ? exportResult.unresolvedCountries.join(", ") : "none"}.`,
  );
  console.log(
    `Unresolved groups: ${exportResult.unresolvedGroups.length > 0 ? exportResult.unresolvedGroups.join(", ") : "none"}.`,
  );
  console.log(`Blank optional fields: ${JSON.stringify(exportResult.blankOptionalCounts)}.`);
  console.log(`Output path: ${filePath}`);
}
