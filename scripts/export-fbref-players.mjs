#!/usr/bin/env node

import { createClient } from "@supabase/supabase-js";
import { resolve } from "node:path";

import {
  DEFAULT_COMPETITION_URL,
  EXPECTED_PLAYERS_PER_TEAM,
  createRequestScheduler,
  discoverSquadPages,
  fetchHtmlWithCache,
  getAllOptionValues,
  getLastOptionValue,
  getOptionNumber,
  loadEnvFile,
  parseRosterPlayers,
  parseSeedHtmlEntries,
  resolveCountryFromTeamPage,
  resolveCountrySquad,
  seedHtmlCache,
  toRelativePath,
  writeJson,
  writePlayerCsv,
} from "./lib/fbref-player-export.mjs";

const DEFAULT_OUTPUT_DIR = "generated/fbref-player-export/players";
const DEFAULT_SUMMARY_PATH = "generated/fbref-player-export/summary.json";
const DEFAULT_CACHE_DIR = "generated/fbref-player-export/cache";
const DEFAULT_THROTTLE_MS = 4000;
const DEFAULT_JITTER_MS = 2000;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_BASE_MS = 8000;
const DEFAULT_REQUEST_TIMEOUT_MS = 45000;
const OPTION_VALUE_ARITY = new Map([
  ["--output-dir", 1],
  ["--summary", 1],
  ["--cache-dir", 1],
  ["--competition-url", 1],
  ["--team-page-url", 1],
  ["--throttle-ms", 1],
  ["--jitter-ms", 1],
  ["--max-retries", 1],
  ["--retry-base-ms", 1],
  ["--request-timeout-ms", 1],
  ["--limit", 1],
  ["--country-slug", 1],
  ["--seed-html", 2],
]);

const argv = process.argv.slice(2);
const flags = new Set(argv.filter((value) => value.startsWith("--")));
const positionalArgs = getPositionalArgs(argv);
const manualSeedHtmlPath = positionalArgs[1] ? resolve(process.cwd(), positionalArgs[1]) : null;
const shortSeedMode = manualSeedHtmlPath != null;

const cacheOnly = flags.has("--cache-only") || shortSeedMode;
const refreshCache = flags.has("--refresh-cache");
const strictMode = flags.has("--strict");
const outputDir = resolve(process.cwd(), getLastOptionValue(argv, "--output-dir") ?? DEFAULT_OUTPUT_DIR);
const summaryPath = resolve(process.cwd(), getLastOptionValue(argv, "--summary") ?? DEFAULT_SUMMARY_PATH);
const cacheDir = resolve(process.cwd(), getLastOptionValue(argv, "--cache-dir") ?? DEFAULT_CACHE_DIR);
const explicitCompetitionUrl = getLastOptionValue(argv, "--competition-url");
const competitionUrl = explicitCompetitionUrl ?? DEFAULT_COMPETITION_URL;
const explicitTeamPageUrl = getLastOptionValue(argv, "--team-page-url");
const manualTeamPageUrl = positionalArgs[0] ?? null;
const throttleMs = getOptionNumber(argv, "--throttle-ms", DEFAULT_THROTTLE_MS);
const jitterMs = getOptionNumber(argv, "--jitter-ms", DEFAULT_JITTER_MS);
const maxRetries = getOptionNumber(argv, "--max-retries", DEFAULT_MAX_RETRIES);
const retryBaseMs = getOptionNumber(argv, "--retry-base-ms", DEFAULT_RETRY_BASE_MS);
const requestTimeoutMs = getOptionNumber(argv, "--request-timeout-ms", DEFAULT_REQUEST_TIMEOUT_MS);
const limit = getLastOptionValue(argv, "--limit") ? getOptionNumber(argv, "--limit", 0) : null;
const countrySlugFilter = Array.from(
  new Set(
    getAllOptionValues(argv, "--country-slug")
      .flatMap((value) => value.split(","))
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  ),
);
const seedHtmlEntries = [
  ...parseSeedHtmlEntries(argv),
  ...(shortSeedMode ? [{ url: positionalArgs[0], filePath: manualSeedHtmlPath }] : []),
];

loadEnvFile(".env.local");
loadEnvFile(".env");

try {
  validateArgs();

  const supabase = createSupabaseReadClient();
  const allCountries = await readCountries(supabase);
  const scheduler = createRequestScheduler({ throttleMs, jitterMs });
  const requestStats = {
    blockedRequests: 0,
    cacheHits: 0,
    cacheMisses: 0,
    networkAttempts: 0,
    networkSuccesses: 0,
  };

  seedHtmlCache(seedHtmlEntries, cacheDir);

  const prefetchedTeamPages = new Map();
  let requestedCountries = [];
  let teamPageByCountrySlug = new Map();
  let resolutionError = null;
  let inputSummary = {
    mode: shortSeedMode
      ? "team-page-url-seeded-html"
      : manualTeamPageUrl
        ? "team-page-url"
        : explicitTeamPageUrl
          ? "single-team-page-legacy"
          : "competition-discovery",
    teamPageUrl: manualTeamPageUrl ?? explicitTeamPageUrl ?? null,
    competitionUrl: manualTeamPageUrl ? null : competitionUrl,
    resolvedCountry: null,
  };

  if (manualTeamPageUrl) {
    const teamPage = await fetchHtmlWithCache(manualTeamPageUrl, {
      cacheDir,
      cacheOnly,
      maxRetries,
      refreshCache,
      requestTimeoutMs,
      retryBaseMs,
      scheduler,
      stats: requestStats,
    });
    const countryResolution = resolveCountryFromTeamPage(teamPage.text, manualTeamPageUrl, allCountries);

    if (countryResolution.status !== "resolved") {
      throw new Error(formatCountryResolutionError(manualTeamPageUrl, countryResolution));
    }

    prefetchedTeamPages.set(manualTeamPageUrl, teamPage);
    requestedCountries = [countryResolution.country];
    teamPageByCountrySlug = new Map([[countryResolution.country.slug, manualTeamPageUrl]]);
    inputSummary = {
      ...inputSummary,
      resolvedCountry: {
        id: countryResolution.country.id,
        slug: countryResolution.country.slug,
        name: countryResolution.country.name,
        matchedBy: countryResolution.matchedBy,
      },
    };
  } else {
    requestedCountries = selectCountries(allCountries);
  }

  if (!manualTeamPageUrl) {
    if (explicitTeamPageUrl) {
      teamPageByCountrySlug = new Map([[requestedCountries[0].slug, explicitTeamPageUrl]]);
    } else {
      try {
        teamPageByCountrySlug = await resolveTeamPages(requestedCountries, {
          cacheDir,
          cacheOnly,
          competitionUrl,
          maxRetries,
          refreshCache,
          requestStats,
          requestTimeoutMs,
          retryBaseMs,
          scheduler,
        });
      } catch (error) {
        resolutionError = error;
      }
    }
  }

  const countryResults = [];

  for (const country of requestedCountries) {
    if (resolutionError) {
      countryResults.push({
        countryId: country.id,
        slug: country.slug,
        name: country.name,
        status: toFailureStatus(resolutionError),
        teamPageUrl: null,
        csvPath: null,
        fetchSource: null,
        playerCount: 0,
        expectedPlayerCount: EXPECTED_PLAYERS_PER_TEAM,
        rosterCountMatchesExpected: false,
        issues: [resolutionError instanceof Error ? resolutionError.message : String(resolutionError)],
      });
      continue;
    }

    const teamPageUrl = teamPageByCountrySlug.get(country.slug) ?? null;

    if (!teamPageUrl) {
      countryResults.push({
        countryId: country.id,
        slug: country.slug,
        name: country.name,
        status: "resolution_failed",
        teamPageUrl: null,
        csvPath: null,
        fetchSource: null,
        playerCount: 0,
        expectedPlayerCount: EXPECTED_PLAYERS_PER_TEAM,
        rosterCountMatchesExpected: false,
        issues: ["Could not resolve an FBRef squad page from the competition page."],
      });
      continue;
    }

    try {
      const page =
        prefetchedTeamPages.get(teamPageUrl) ??
        (await fetchHtmlWithCache(teamPageUrl, {
          cacheDir,
          cacheOnly,
          maxRetries,
          refreshCache,
          requestTimeoutMs,
          retryBaseMs,
          scheduler,
          stats: requestStats,
        }));
      const players = parseRosterPlayers(page.text, country);
      const csvPath = resolve(outputDir, `${country.slug}.csv`);
      const rosterCountMatchesExpected = players.length === EXPECTED_PLAYERS_PER_TEAM;
      const issues = rosterCountMatchesExpected
        ? []
        : [`Expected ${EXPECTED_PLAYERS_PER_TEAM} roster rows, parsed ${players.length}.`];

      writePlayerCsv(csvPath, players);

      countryResults.push({
        countryId: country.id,
        slug: country.slug,
        name: country.name,
        status: rosterCountMatchesExpected ? "exported" : "exported_with_mismatch",
        teamPageUrl,
        csvPath: toRelativePath(csvPath),
        fetchSource: page.source,
        playerCount: players.length,
        expectedPlayerCount: EXPECTED_PLAYERS_PER_TEAM,
        rosterCountMatchesExpected,
        issues,
      });
    } catch (error) {
      countryResults.push({
        countryId: country.id,
        slug: country.slug,
        name: country.name,
        status: toFailureStatus(error),
        teamPageUrl,
        csvPath: null,
        fetchSource: null,
        playerCount: 0,
        expectedPlayerCount: EXPECTED_PLAYERS_PER_TEAM,
        rosterCountMatchesExpected: false,
        issues: [error instanceof Error ? error.message : String(error)],
      });
    }
  }

  const summary = buildSummary({
    cacheDir,
    cacheOnly,
    competitionUrl,
    countryResults,
    outputDir,
    requestedCountries,
    requestStats,
    inputSummary,
    seedHtmlEntries,
    throttleMs,
    jitterMs,
    maxRetries,
    retryBaseMs,
    requestTimeoutMs,
  });

  writeJson(summaryPath, summary);
  printSummary(summary, summaryPath);

  if (shouldFail(summary)) {
    process.exit(1);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

function validateArgs() {
  if (positionalArgs.length > 2) {
    throw new Error("Provide either one positional FBRef team URL, or a team URL plus a saved HTML file path.");
  }

  if (manualTeamPageUrl && !isValidHttpUrl(manualTeamPageUrl)) {
    throw new Error(`Invalid FBRef team URL: ${manualTeamPageUrl}`);
  }

  if (!manualTeamPageUrl && manualSeedHtmlPath) {
    throw new Error("A saved HTML file positional argument requires a positional FBRef team URL first.");
  }

  if (manualTeamPageUrl && explicitTeamPageUrl) {
    throw new Error("Choose either a positional FBRef team URL or --team-page-url, not both.");
  }

  if (manualTeamPageUrl && countrySlugFilter.length > 0) {
    throw new Error("A positional FBRef team URL cannot be combined with --country-slug.");
  }

  if (manualTeamPageUrl && limit != null) {
    throw new Error("A positional FBRef team URL cannot be combined with --limit.");
  }

  if (manualTeamPageUrl && explicitCompetitionUrl) {
    throw new Error("A positional FBRef team URL cannot be combined with --competition-url.");
  }

  if (countrySlugFilter.length === 0 && explicitTeamPageUrl) {
    throw new Error("--team-page-url requires exactly one --country-slug target.");
  }

  if (countrySlugFilter.length > 1 && explicitTeamPageUrl) {
    throw new Error("--team-page-url can only be used with a single country slug.");
  }

  if (throttleMs < 0 || jitterMs < 0 || maxRetries < 1 || retryBaseMs < 0 || requestTimeoutMs < 1000) {
    throw new Error("Invalid request timing options. Check throttle, jitter, retry, and timeout flags.");
  }
}

function createSupabaseReadClient() {
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
        "X-Client-Info": "wc26-fbref-player-exporter",
      },
    },
  });
}

async function readCountries(supabase) {
  const response = await supabase.from("country").select("id,name,slug").order("id", { ascending: true });

  if (response.error) {
    throw new Error(`Could not read public.country: ${response.error.message}`);
  }

  return response.data ?? [];
}

function selectCountries(countries) {
  const filtered =
    countrySlugFilter.length > 0
      ? countries.filter((country) => countrySlugFilter.includes(country.slug.toLowerCase()))
      : countries;

  if (filtered.length === 0) {
    throw new Error("No countries matched the requested --country-slug filter.");
  }

  if (limit == null) return filtered;
  return filtered.slice(0, limit);
}

async function resolveTeamPages(countries, options) {
  const competitionPage = await fetchHtmlWithCache(options.competitionUrl, {
    cacheDir: options.cacheDir,
    cacheOnly: options.cacheOnly,
    maxRetries: options.maxRetries,
    refreshCache: options.refreshCache,
    requestTimeoutMs: options.requestTimeoutMs,
    retryBaseMs: options.retryBaseMs,
    scheduler: options.scheduler,
    stats: options.requestStats,
  });
  const discoveredSquads = discoverSquadPages(competitionPage.text, options.competitionUrl);
  const teamPageByCountrySlug = new Map();

  for (const country of countries) {
    const resolution = resolveCountrySquad(country, discoveredSquads);
    if (resolution.status === "resolved" && resolution.teamPageUrl) {
      teamPageByCountrySlug.set(country.slug, resolution.teamPageUrl);
    }
  }

  return teamPageByCountrySlug;
}

function buildSummary(context) {
  const exportedTeams = context.countryResults.filter((result) => result.status === "exported" || result.status === "exported_with_mismatch");
  const unresolvedTeams = context.countryResults.filter((result) => result.status === "resolution_failed");
  const blockedTeams = context.countryResults.filter((result) => result.status === "fetch_blocked");
  const parseFailures = context.countryResults.filter((result) => result.status === "scrape_failed");
  const rosterCountMismatches = context.countryResults.filter(
    (result) => (result.status === "exported" || result.status === "exported_with_mismatch") && !result.rosterCountMatchesExpected,
  );

  return {
    generatedAt: new Date().toISOString(),
    mode: context.cacheOnly ? "cache-only" : "network-with-cache",
    competitionUrl: context.inputSummary.competitionUrl,
    input: context.inputSummary,
    requestPolicy: {
      sequential: true,
      throttleMs: context.throttleMs,
      jitterMs: context.jitterMs,
      maxRetries: context.maxRetries,
      retryBaseMs: context.retryBaseMs,
      requestTimeoutMs: context.requestTimeoutMs,
      cacheDir: toRelativePath(context.cacheDir),
    },
    cacheSeeding: context.seedHtmlEntries.map((entry) => ({
      url: entry.url,
      filePath: toRelativePath(entry.filePath),
    })),
    counts: {
      requestedCountries: context.requestedCountries.length,
      exportedTeams: exportedTeams.length,
      unresolvedTeams: unresolvedTeams.length,
      blockedTeams: blockedTeams.length,
      parseFailures: parseFailures.length,
      rosterCountMismatches: rosterCountMismatches.length,
    },
    fetchStats: context.requestStats,
    issues: {
      resolution: unresolvedTeams.map(minimalIssue),
      blocked: blockedTeams.map(minimalIssue),
      parseFailures: parseFailures.map(minimalIssue),
      rosterCountMismatches: rosterCountMismatches.map(minimalIssue),
    },
    countries: context.countryResults,
    outputDirectory: toRelativePath(context.outputDir),
  };
}

function minimalIssue(result) {
  return {
    slug: result.slug,
    name: result.name,
    status: result.status,
    teamPageUrl: result.teamPageUrl,
    issues: result.issues,
  };
}

function printSummary(summary, filePath) {
  console.log(`FBRef player export complete: ${summary.counts.exportedTeams}/${summary.counts.requestedCountries} teams exported.`);
  if (summary.input?.resolvedCountry) {
    console.log(`Target country: ${summary.input.resolvedCountry.name} (${summary.input.resolvedCountry.slug}).`);
  }
  if (summary.input?.teamPageUrl) {
    console.log(`Team page URL: ${summary.input.teamPageUrl}.`);
  }
  console.log(`Mode: ${summary.mode}. Cache directory: ${summary.requestPolicy.cacheDir}.`);
  console.log(`Blocked teams: ${summary.counts.blockedTeams}. Resolution failures: ${summary.counts.unresolvedTeams}.`);
  console.log(`Roster count mismatches: ${summary.counts.rosterCountMismatches}.`);
  console.log(`Summary JSON: ${toRelativePath(filePath)}`);
}

function shouldFail(summary) {
  if (summary.counts.exportedTeams === 0) return true;
  if (!strictMode) return false;

  return (
    summary.counts.unresolvedTeams > 0 ||
    summary.counts.blockedTeams > 0 ||
    summary.counts.parseFailures > 0 ||
    summary.counts.rosterCountMismatches > 0
  );
}

function toFailureStatus(error) {
  if (error?.code === "cloudflare_challenge" || error?.code === "cache_miss") {
    return "fetch_blocked";
  }

  if (typeof error?.code === "string" && error.code.startsWith("roster_")) {
    return "scrape_failed";
  }

  return "scrape_failed";
}

function getPositionalArgs(argv) {
  const positionals = [];

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];

    if (value === "--") {
      positionals.push(...argv.slice(index + 1));
      break;
    }

    if (!value.startsWith("--")) {
      positionals.push(value);
      continue;
    }

    const [optionName] = value.split("=", 1);

    if (value.includes("=")) continue;

    const arity = OPTION_VALUE_ARITY.get(optionName) ?? 0;
    index += arity;
  }

  return positionals;
}

function isValidHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function formatCountryResolutionError(teamPageUrl, resolution) {
  const candidates = resolution.candidates?.length
    ? ` Candidates: ${resolution.candidates.join("; ")}.`
    : "";

  if (resolution.status === "ambiguous") {
    const matches = resolution.matches
      .map((match) => `${match.name} (${match.slug}) via ${match.matchedBy.join(", ")}`)
      .join(" | ");
    return `Could not infer a unique country from ${teamPageUrl}. Matched multiple countries: ${matches}.${candidates}`;
  }

  return `Could not infer a country from ${teamPageUrl}.${candidates}`;
}
