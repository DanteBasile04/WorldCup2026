import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { decodeHtml, normalizeName, sleep, stripTags } from "./qualified-countries.mjs";

export const DEFAULT_COMPETITION_URL = "https://fbref.com/en/comps/1/World-Cup-Stats";
export const PLAYER_CSV_COLUMNS = [
  "country_id",
  "name",
  "height_cm",
  "weight_kg",
  "preferred_foot",
  "current_club",
  "position",
  "age",
];
export const EXPECTED_PLAYERS_PER_TEAM = 26;
export const FBREF_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36 wc26-fbref-player-exporter/1.0";

const COUNTRY_FBREF_ALIASES = new Map([
  [normalizeName("Bosnia and Herzegovina"), ["Bosnia-Herzegovina", "Bosnia Herzegovina"]],
  [normalizeName("Czech Republic"), ["Czechia"]],
  [normalizeName("DR Congo"), ["Congo DR"]],
  [normalizeName("Iran"), ["IR Iran"]],
  [normalizeName("Ivory Coast"), ["Cote d'Ivoire", "Cote dIvoire", "Côte d'Ivoire"]],
  [normalizeName("South Korea"), ["Korea Republic"]],
  [normalizeName("Turkey"), ["Turkiye", "Türkiye"]],
]);

export function loadEnvFile(fileName) {
  const filePath = resolve(process.cwd(), fileName);

  if (!existsSync(filePath)) return;

  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
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

export function getAllOptionValues(argv, optionName) {
  const values = [];

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];

    if (value === optionName) {
      const nextValue = argv[index + 1];

      if (!nextValue || nextValue.startsWith("--")) {
        throw new Error(`Missing value for ${optionName}.`);
      }

      values.push(nextValue);
      index += 1;
      continue;
    }

    if (value.startsWith(`${optionName}=`)) {
      values.push(value.slice(optionName.length + 1).trim());
    }
  }

  return values;
}

export function getOptionNumber(argv, optionName, defaultValue) {
  const rawValue = getLastOptionValue(argv, optionName);
  if (rawValue == null) return defaultValue;

  const parsed = Number.parseInt(rawValue, 10);

  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid numeric value for ${optionName}: ${rawValue}`);
  }

  return parsed;
}

export function getLastOptionValue(argv, optionName) {
  const values = getAllOptionValues(argv, optionName);
  return values.length > 0 ? values.at(-1) : null;
}

export function parseSeedHtmlEntries(argv) {
  const entries = [];

  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] !== "--seed-html") continue;

    const url = argv[index + 1];
    const filePath = argv[index + 2];

    if (!url || url.startsWith("--") || !filePath || filePath.startsWith("--")) {
      throw new Error("--seed-html requires exactly two values: <url> <filePath>.");
    }

    entries.push({ url, filePath: resolve(process.cwd(), filePath) });
    index += 2;
  }

  return entries;
}

export function createRequestScheduler({ throttleMs, jitterMs }) {
  let lastRequestStartedAt = 0;

  return {
    async waitTurn() {
      const now = Date.now();
      const jitter = jitterMs > 0 ? Math.floor(Math.random() * (jitterMs + 1)) : 0;
      const earliestStart = lastRequestStartedAt + throttleMs + jitter;
      const waitMs = Math.max(0, earliestStart - now);

      if (waitMs > 0) {
        await sleep(waitMs);
      }

      lastRequestStartedAt = Date.now();
    },
  };
}

export function seedHtmlCache(seedEntries, cacheDir) {
  for (const entry of seedEntries) {
    if (!existsSync(entry.filePath)) {
      throw new Error(`Seed HTML file does not exist: ${entry.filePath}`);
    }

    writeCacheEntry(cacheDir, entry.url, deserializeHtmlPayload(readFileSync(entry.filePath, "utf8")), {
      status: 200,
      source: "seed-html",
      seededFrom: entry.filePath,
    });
  }
}

export async function fetchHtmlWithCache(url, options) {
  const {
    cacheDir,
    cacheOnly,
    refreshCache,
    scheduler,
    maxRetries,
    retryBaseMs,
    requestTimeoutMs,
    stats,
  } = options;
  const cached = !refreshCache ? readCacheEntry(cacheDir, url) : null;

  if (cached) {
    stats.cacheHits += 1;
    return { url, text: cached.body, source: cached.metadata?.source === "seed-html" ? "seed-html" : "cache" };
  }

  if (cacheOnly) {
    stats.cacheMisses += 1;
    throw Object.assign(new Error(`Cache miss for ${url}`), { code: "cache_miss", url });
  }

  let lastError = null;

  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    if (attempt > 1) {
      const retryDelay = retryBaseMs * 2 ** (attempt - 2);
      await sleep(retryDelay);
    }

    await scheduler.waitTurn();
    stats.networkAttempts += 1;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);

    try {
      const response = await fetch(url, {
        redirect: "follow",
        signal: controller.signal,
        headers: {
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
          "User-Agent": FBREF_USER_AGENT,
        },
      });
      const text = await response.text();

      if (isCloudflareChallenge(response, text)) {
        throw Object.assign(new Error(`FBRef blocked automated HTTP access for ${url}`), {
          code: "cloudflare_challenge",
          status: response.status,
          url,
        });
      }

      if (!response.ok) {
        const error = Object.assign(new Error(`FBRef request failed: ${response.status} ${response.statusText}`), {
          code: "http_error",
          status: response.status,
          url,
        });

        if (isRetryableStatus(response.status) && attempt < maxRetries) {
          lastError = error;
          continue;
        }

        throw error;
      }

      writeCacheEntry(cacheDir, url, text, {
        source: "network",
        status: response.status,
        fetchedAt: new Date().toISOString(),
      });
      stats.networkSuccesses += 1;

      return { url, text, source: "network" };
    } catch (error) {
      lastError = error;

      if (error?.code === "cloudflare_challenge") {
        stats.blockedRequests += 1;
        throw error;
      }

      if (attempt >= maxRetries || !isRetryableError(error)) {
        throw error;
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError ?? new Error(`Unknown FBRef request failure for ${url}`);
}

export function discoverSquadPages(competitionHtml, competitionUrl) {
  const byUrl = new Map();

  for (const match of competitionHtml.matchAll(/<a[^>]+href="(\/en\/squads\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = decodeHtml(match[1]);
    const absoluteUrl = new URL(href, competitionUrl).toString();

    if (!/^https:\/\/fbref\.com\/en\/squads\/[a-z0-9]+\/[A-Za-z0-9-]+-Men-Stats$/i.test(absoluteUrl)) {
      continue;
    }

    const text = cleanText(match[2]);
    if (!text) continue;

    const urlLabel = absoluteUrl
      .split("/")
      .at(-1)
      ?.replace(/-Men-Stats$/i, "")
      ?.replace(/-/g, " ")
      ?.trim();

    const keys = new Set([normalizeName(text)]);
    if (urlLabel) keys.add(normalizeName(urlLabel));

    if (!byUrl.has(absoluteUrl)) {
      byUrl.set(absoluteUrl, {
        url: absoluteUrl,
        text,
        urlLabel: urlLabel ?? text,
        keys,
      });
      continue;
    }

    const existing = byUrl.get(absoluteUrl);
    for (const key of keys) {
      existing.keys.add(key);
    }
  }

  return Array.from(byUrl.values());
}

export function resolveCountrySquad(country, discoveredSquads) {
  const candidateKeys = getCountryLookupKeys(country);
  const matches = discoveredSquads.filter((squad) => Array.from(candidateKeys).some((key) => squad.keys.has(key)));

  if (matches.length === 0) {
    return { country, status: "unresolved", teamPageUrl: null, matchedBy: [] };
  }

  const byUrl = new Map(matches.map((match) => [match.url, match]));
  const uniqueMatches = Array.from(byUrl.values());

  if (uniqueMatches.length > 1) {
    const exactNameMatch = uniqueMatches.find((match) => match.keys.has(normalizeName(country.name)));

    if (exactNameMatch) {
      return {
        country,
        status: "resolved",
        teamPageUrl: exactNameMatch.url,
        matchedBy: [country.name],
      };
    }

    return {
      country,
      status: "ambiguous",
      teamPageUrl: null,
      matchedBy: uniqueMatches.map((match) => `${match.text} -> ${match.url}`),
    };
  }

  return {
    country,
    status: "resolved",
    teamPageUrl: uniqueMatches[0].url,
    matchedBy: Array.from(candidateKeys),
  };
}

export function resolveCountryFromTeamPage(teamPageHtml, teamPageUrl, countries) {
  const lookup = buildCountryLookupIndex(countries);
  const candidates = collectTeamPageCountryCandidates(teamPageHtml, teamPageUrl);
  const matchesBySlug = new Map();

  for (const candidate of candidates) {
    const matchedCountries = lookup.get(normalizeName(candidate.value)) ?? [];

    for (const country of matchedCountries) {
      const existing = matchesBySlug.get(country.slug) ?? {
        country,
        matchedBy: [],
      };
      const matchedByLabel = `${candidate.source}: ${candidate.value}`;

      if (!existing.matchedBy.includes(matchedByLabel)) {
        existing.matchedBy.push(matchedByLabel);
      }

      matchesBySlug.set(country.slug, existing);
    }
  }

  if (matchesBySlug.size === 1) {
    const match = Array.from(matchesBySlug.values())[0];
    return {
      status: "resolved",
      country: match.country,
      matchedBy: match.matchedBy,
      candidates: candidates.map((candidate) => `${candidate.source}: ${candidate.value}`),
    };
  }

  if (matchesBySlug.size > 1) {
    return {
      status: "ambiguous",
      matches: Array.from(matchesBySlug.values()).map((match) => ({
        slug: match.country.slug,
        name: match.country.name,
        matchedBy: match.matchedBy,
      })),
      candidates: candidates.map((candidate) => `${candidate.source}: ${candidate.value}`),
    };
  }

  return {
    status: "unresolved",
    matches: [],
    candidates: candidates.map((candidate) => `${candidate.source}: ${candidate.value}`),
  };
}

export function parseRosterPlayers(teamPageHtml, country) {
  const rosterTable = teamPageHtml.match(/<table[^>]+id="roster"[\s\S]*?<\/table>/i)?.[0];

  if (!rosterTable) {
    throw Object.assign(new Error(`Could not find the FBRef roster table for ${country.name}.`), {
      code: "roster_table_missing",
      country,
    });
  }

  const tbody = extractRosterTableBody(rosterTable);

  if (!tbody) {
    throw Object.assign(new Error(`Could not find roster table rows for ${country.name}.`), {
      code: "roster_body_missing",
      country,
    });
  }

  const players = [];

  for (const rowMatch of tbody.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const rowHtml = rowMatch[0];
    if (/class="[^"]*thead[^"]*"/i.test(rowHtml)) continue;

    const playerName = extractAnchorText(extractDataStatCell(rowHtml, "player")) ?? cleanText(extractDataStatCell(rowHtml, "player"));
    const position = cleanText(extractDataStatCell(rowHtml, "position"));
    const currentClub = extractAnchorText(extractDataStatCell(rowHtml, "club")) ?? normalizeClubCell(cleanText(extractDataStatCell(rowHtml, "club")));
    const age = parseAge(extractDataStatCell(rowHtml, "age"));

    if (!playerName) continue;

    players.push({
      country_id: country.id,
      name: playerName,
      height_cm: "",
      weight_kg: "",
      preferred_foot: "",
      current_club: currentClub ?? "",
      position: position ?? "",
      age: age ?? "",
    });
  }

  if (players.length === 0) {
    throw Object.assign(new Error(`FBRef roster parsing returned zero players for ${country.name}.`), {
      code: "roster_empty",
      country,
    });
  }

  return players;
}

function extractRosterTableBody(rosterTableHtml) {
  const closedTbody = rosterTableHtml.match(/<tbody\b[^>]*>([\s\S]*?)<\/tbody>/i)?.[1];
  if (closedTbody) return closedTbody;

  const openTbody = rosterTableHtml.match(/<tbody\b[^>]*>([\s\S]*)$/i)?.[1];
  if (openTbody) return openTbody;

  return rosterTableHtml.match(/<\/thead>([\s\S]*)$/i)?.[1] ?? null;
}

export function writePlayerCsv(filePath, rows) {
  mkdirSync(resolve(filePath, ".."), { recursive: true });
  writeFileSync(filePath, toCsv(rows, PLAYER_CSV_COLUMNS), "utf8");
}

export function writeJson(filePath, value) {
  mkdirSync(resolve(filePath, ".."), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function toCacheKey(url) {
  return createHash("sha1").update(url).digest("hex");
}

export function toRelativePath(absolutePath) {
  const workspaceRoot = process.cwd();
  return absolutePath.startsWith(workspaceRoot)
    ? absolutePath.slice(workspaceRoot.length + 1).replaceAll("\\", "/")
    : absolutePath.replaceAll("\\", "/");
}

function readCacheEntry(cacheDir, url) {
  const paths = getCachePaths(cacheDir, url);

  if (!existsSync(paths.body)) return null;

  return {
    body: readFileSync(paths.body, "utf8"),
    metadata: existsSync(paths.meta) ? JSON.parse(readFileSync(paths.meta, "utf8")) : null,
  };
}

function writeCacheEntry(cacheDir, url, body, metadata) {
  const paths = getCachePaths(cacheDir, url);
  mkdirSync(cacheDir, { recursive: true });
  writeFileSync(paths.body, body, "utf8");
  writeFileSync(
    paths.meta,
    `${JSON.stringify({ url, cachedAt: new Date().toISOString(), ...metadata }, null, 2)}\n`,
    "utf8",
  );
}

function getCachePaths(cacheDir, url) {
  const cacheKey = toCacheKey(url);
  return {
    body: resolve(cacheDir, `${cacheKey}.html`),
    meta: resolve(cacheDir, `${cacheKey}.json`),
  };
}

function getCountryLookupKeys(country) {
  const keys = new Set([
    normalizeName(country.name),
    normalizeName(country.slug.replaceAll("-", " ")),
  ]);

  for (const alias of COUNTRY_FBREF_ALIASES.get(normalizeName(country.name)) ?? []) {
    keys.add(normalizeName(alias));
  }

  return keys;
}

function buildCountryLookupIndex(countries) {
  const byKey = new Map();

  for (const country of countries) {
    for (const key of getCountryLookupKeys(country)) {
      const existing = byKey.get(key) ?? [];
      existing.push(country);
      byKey.set(key, existing);
    }
  }

  return byKey;
}

function collectTeamPageCountryCandidates(teamPageHtml, teamPageUrl) {
  const rawCandidates = [
    {
      source: "url",
      value: extractTeamUrlLabel(teamPageUrl),
    },
    {
      source: "title",
      value: cleanText(teamPageHtml.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? ""),
    },
    {
      source: "og:title",
      value: cleanText(teamPageHtml.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i)?.[1] ?? ""),
    },
    {
      source: "twitter:title",
      value: cleanText(teamPageHtml.match(/<meta[^>]+name="twitter:title"[^>]+content="([^"]+)"/i)?.[1] ?? ""),
    },
    {
      source: "h1",
      value: cleanText(teamPageHtml.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? ""),
    },
  ].filter((candidate) => candidate.value);

  const seen = new Set();
  const expanded = [];

  for (const candidate of rawCandidates) {
    for (const value of expandCountryCandidates(candidate.value)) {
      const key = `${candidate.source}:${normalizeName(value)}`;
      if (seen.has(key)) continue;

      seen.add(key);
      expanded.push({
        source: candidate.source,
        value,
      });
    }
  }

  return expanded;
}

function expandCountryCandidates(value) {
  const queue = [cleanText(value).replaceAll("_", " ")];
  const seen = new Set();
  const results = [];

  while (queue.length > 0) {
    const current = queue.shift()?.trim() ?? "";
    const normalized = normalizeName(current);

    if (!current || seen.has(normalized)) continue;

    seen.add(normalized);
    results.push(current);

    for (const next of [
      current.replace(/^\d{4}\s+/, "").trim(),
      current.replace(/\s*\([^)]*\)\s*$/g, "").trim(),
      current.replace(/\s*\|\s*FBref\.com$/i, "").trim(),
      current.replace(/\s*\|\s*.*$/i, "").trim(),
      current.replace(/\s*,\s*.*$/i, "").trim(),
      current.replace(/\b(?:Men|Women)\s+Stats\b.*$/i, "").trim(),
      current.replace(/\bStats\b.*$/i, "").trim(),
      current.replace(/\b(?:Men|Women)\b$/i, "").trim(),
      current.replace(/\s+-\s+.*$/i, "").trim(),
    ]) {
      const normalizedNext = normalizeName(next);
      if (next && !seen.has(normalizedNext)) {
        queue.push(next);
      }
    }
  }

  return results;
}

function extractTeamUrlLabel(teamPageUrl) {
  try {
    const url = new URL(teamPageUrl);
    const slug = url.pathname.split("/").at(-1) ?? "";
    return slug.replace(/-Stats$/i, "").replace(/-/g, " ").trim();
  } catch {
    return "";
  }
}

function extractDataStatCell(rowHtml, dataStat) {
  const cellMatch = rowHtml.match(new RegExp(`<(?:td|th)[^>]*data-stat="${dataStat}"[^>]*>([\\s\\S]*?)<\\/(?:td|th)>`, "i"));
  return cellMatch?.[1] ?? "";
}

function extractAnchorText(cellHtml) {
  if (!cellHtml) return null;

  const anchors = Array.from(cellHtml.matchAll(/<a[^>]*>([\s\S]*?)<\/a>/gi));
  if (anchors.length === 0) return null;

  return cleanText(anchors.at(-1)?.[1] ?? "");
}

function cleanText(value) {
  return decodeHtml(stripTags(String(value ?? ""))).replace(/\s+/g, " ").trim();
}

function normalizeClubCell(value) {
  if (!value) return "";
  return value.replace(/^\d+\./, "").replace(/^[A-Za-z]{2}\s+/, "").trim();
}

function parseAge(cellHtml) {
  const value = cleanText(cellHtml);
  const years = value.match(/^(\d+)/)?.[1];

  if (!years) return null;

  const parsed = Number.parseInt(years, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function isCloudflareChallenge(response, text) {
  return (
    response.status === 403 &&
    (response.headers.get("cf-mitigated") === "challenge" ||
      /just a moment/i.test(text) ||
      /enable javascript and cookies to continue/i.test(text))
  );
}

function isRetryableStatus(status) {
  return [408, 425, 429, 500, 502, 503, 504].includes(status);
}

function isRetryableError(error) {
  if (!error) return false;
  if (error.name === "AbortError") return true;
  if (error.code === "UND_ERR_CONNECT_TIMEOUT") return true;
  if (error.code === "http_error") return isRetryableStatus(error.status);
  return error.code !== "cloudflare_challenge";
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

function deserializeHtmlPayload(value) {
  const trimmed = String(value ?? "").trim();

  if (!trimmed.startsWith('"')) return String(value ?? "");

  try {
    const parsed = JSON.parse(trimmed);
    return typeof parsed === "string" ? parsed : String(value ?? "");
  } catch {
    return String(value ?? "");
  }
}
