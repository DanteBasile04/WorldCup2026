import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { normalizePlayerNameForMatching, toCompactPlayerNameKey } from "./player-name-normalizer.mjs";
import { normalizeName, slugifyName } from "./qualified-countries.mjs";

const catalogCache = new Map();
const rosterCatalogCache = new Map();
const EMBEDDED_TOKEN_LIMIT = 10;
const EMBEDDED_NGRAM_WORD_LIMIT = 5;
const DEFAULT_ROSTER_FIXTURE_DIR = resolve(process.cwd(), "sources", "roster-fixtures");
const MIN_ROSTER_MATCH_COUNT = 4;
const MIN_ROSTER_EXACT_MATCHES = 3;
const MIN_ROSTER_SCORE_GAP = 2;
const MANUAL_TEAM_ALIASES = {
  "cape verde": ["cabo verde"],
  "czech republic": ["czechia"],
  "dr congo": ["congo dr", "congo d r", "drc", "democratic republic of congo"],
  "iran": ["ir iran"],
  "ivory coast": ["cote d'ivoire", "cote d ivoire", "cote divoire"],
  "south korea": ["korea republic", "republic of korea", "korea rep"],
  "united states": ["usa", "us", "u s a", "united states of america"],
};

export function listTeamSlugCatalog({ samplesRoot = resolve(process.cwd(), "samples/teams") } = {}) {
  const resolvedRoot = resolve(samplesRoot);

  if (catalogCache.has(resolvedRoot)) {
    return catalogCache.get(resolvedRoot);
  }

  const directories = readdirSync(resolvedRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => buildCatalogEntry(resolvedRoot, entry.name))
    .sort((left, right) => left.name.localeCompare(right.name, "en"));

  catalogCache.set(resolvedRoot, directories);
  return directories;
}

export function resolveTeamSlug(
  teamName,
  {
    samplesRoot = resolve(process.cwd(), "samples/teams"),
    playerNames = [],
    rosterFixtureDir = DEFAULT_ROSTER_FIXTURE_DIR,
  } = {},
) {
  const catalog = listTeamSlugCatalog({ samplesRoot });
  const inputName = String(teamName ?? "").trim();
  const normalizedInput = normalizeLoose(inputName);
  const compactInput = toCompactKey(inputName);

  if (!inputName) {
    return {
      resolved: false,
      inputName,
      suggestions: [],
      reason: "Team name is empty.",
    };
  }

  const exactMatch = catalog.find((entry) => entry.aliases.has(normalizedInput));

  if (exactMatch) {
    return toResolution(inputName, exactMatch, "exact");
  }

  const compactMatch = catalog.find((entry) => entry.compactAliases.has(compactInput));

  if (compactMatch) {
    return toResolution(inputName, compactMatch, "compact");
  }

  const embeddedExactMatch = findEmbeddedCatalogMatch(catalog, inputName, { useCompact: false });

  if (embeddedExactMatch) {
    return toResolution(inputName, embeddedExactMatch.entry, "embedded-exact", embeddedExactMatch.score);
  }

  const embeddedCompactMatch = findEmbeddedCatalogMatch(catalog, inputName, { useCompact: true });

  if (embeddedCompactMatch) {
    return toResolution(inputName, embeddedCompactMatch.entry, "embedded-compact", embeddedCompactMatch.score);
  }

  const scored = catalog
    .map((entry) => ({
      entry,
      score: scoreCandidate(normalizedInput, entry),
    }))
    .sort((left, right) => right.score - left.score);

  if (scored[0]?.score >= 0.8 && (!scored[1] || scored[0].score - scored[1].score >= 0.15)) {
    return toResolution(inputName, scored[0].entry, "fuzzy", scored[0].score);
  }

  const rosterBackedMatch = findRosterBackedCatalogMatch(catalog, playerNames, {
    rosterFixtureDir,
  });

  if (rosterBackedMatch) {
    return toResolution(inputName, rosterBackedMatch.entry, "roster-players", rosterBackedMatch.score);
  }

  return {
    resolved: false,
    inputName,
    suggestions: scored.slice(0, 3).map(({ entry }) => ({
      name: entry.name,
      slug: entry.slug,
      folder: entry.folder,
    })),
    reason: "No team folder matched the OCR team name with enough confidence.",
  };
}

function findRosterBackedCatalogMatch(catalog, playerNames, { rosterFixtureDir }) {
  const normalizedPlayers = normalizeCapturedPlayerNames(playerNames);

  if (normalizedPlayers.length === 0 || !existsSync(rosterFixtureDir)) {
    return null;
  }

  const rosterCatalog = listTeamRosterCatalog({ catalog, rosterFixtureDir });
  const scored = rosterCatalog
    .map((entry) => scoreRosterCatalogEntry(normalizedPlayers, entry))
    .filter((candidate) => candidate.matchCount > 0)
    .sort((left, right) => right.score - left.score);

  const best = scored[0] ?? null;
  const second = scored[1] ?? null;

  if (!best) {
    return null;
  }

  const hasSafeGap = !second || best.score - second.score >= MIN_ROSTER_SCORE_GAP;

  if (
    best.matchCount >= MIN_ROSTER_MATCH_COUNT
    && best.exactMatches >= MIN_ROSTER_EXACT_MATCHES
    && hasSafeGap
  ) {
    return best;
  }

  return null;
}

function listTeamRosterCatalog({ catalog, rosterFixtureDir }) {
  const cacheKey = `${rosterFixtureDir}::${catalog.map((entry) => entry.slug).join("|")}`;

  if (rosterCatalogCache.has(cacheKey)) {
    return rosterCatalogCache.get(cacheKey);
  }

  const rosterEntries = catalog
    .map((entry) => buildRosterCatalogEntry(entry, rosterFixtureDir))
    .filter(Boolean);

  rosterCatalogCache.set(cacheKey, rosterEntries);
  return rosterEntries;
}

function buildRosterCatalogEntry(entry, rosterFixtureDir) {
  const candidatePaths = [
    resolve(rosterFixtureDir, `${entry.slug}.players.json`),
    resolve(rosterFixtureDir, `${entry.slug}.json`),
  ];
  const rosterPath = candidatePaths.find((candidate) => existsSync(candidate));

  if (!rosterPath) {
    return null;
  }

  const payload = JSON.parse(readFileSync(rosterPath, "utf8"));
  const players = Array.isArray(payload) ? payload : payload?.players;

  if (!Array.isArray(players) || players.length === 0) {
    return null;
  }

  return {
    entry,
    players: players
      .map((player) => buildRosterPlayerEntry(player))
      .filter(Boolean),
  };
}

function buildRosterPlayerEntry(player) {
  const rawName = String(player?.name ?? "").trim();

  if (!rawName) {
    return null;
  }

  return {
    normalized: normalizePlayerNameForMatching(rawName),
    compact: toCompactPlayerNameKey(rawName),
  };
}

function normalizeCapturedPlayerNames(playerNames) {
  return Array.from(
    new Set(
      (Array.isArray(playerNames) ? playerNames : [])
        .map((value) => String(value ?? "").trim())
        .filter(Boolean),
    ),
  ).map((name) => ({
    normalized: normalizePlayerNameForMatching(name),
    compact: toCompactPlayerNameKey(name),
  })).filter((player) => player.compact.length >= 5);
}

function scoreRosterCatalogEntry(capturedPlayers, rosterEntry) {
  const usedIndexes = new Set();
  let exactMatches = 0;
  let fuzzyMatches = 0;

  for (const captured of capturedPlayers) {
    const exactIndex = rosterEntry.players.findIndex(
      (player, index) => !usedIndexes.has(index) && player.compact === captured.compact,
    );

    if (exactIndex >= 0) {
      usedIndexes.add(exactIndex);
      exactMatches += 1;
      continue;
    }

    let bestIndex = -1;
    let bestSimilarity = 0;

    for (const [index, player] of rosterEntry.players.entries()) {
      if (usedIndexes.has(index)) {
        continue;
      }

      const similarity = similarityScore(captured.compact, player.compact);

      if (similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestIndex = index;
      }
    }

    if (bestIndex >= 0 && bestSimilarity >= 0.94) {
      usedIndexes.add(bestIndex);
      fuzzyMatches += 1;
    }
  }

  return {
    entry: rosterEntry.entry,
    exactMatches,
    fuzzyMatches,
    matchCount: exactMatches + fuzzyMatches,
    score: exactMatches + fuzzyMatches * 0.6,
  };
}

function buildCatalogEntry(samplesRoot, folderName) {
  const folderPath = resolve(samplesRoot, folderName);
  const inputPath = resolve(folderPath, "country-formation-input.json");
  const payload = existsSync(inputPath) ? JSON.parse(readFileSync(inputPath, "utf8")) : null;
  const name = payload?.country?.name ?? payload?.team?.name ?? folderName;
  const slug = payload?.country?.slug ?? slugifyName(name);
  const aliases = new Set([
    normalizeLoose(folderName),
    normalizeLoose(name),
    normalizeLoose(slug),
  ]);

  for (const alias of MANUAL_TEAM_ALIASES[normalizeLoose(name)] ?? []) {
    aliases.add(normalizeLoose(alias));
  }

  const compactAliases = new Set(Array.from(aliases, toCompactKey));

  return {
    name,
    slug,
    folder: folderName,
    folderPath,
    aliases,
    compactAliases,
  };
}

function toResolution(inputName, entry, matchType, score = 1) {
  return {
    resolved: true,
    inputName,
    name: entry.name,
    slug: entry.slug,
    folder: entry.folder,
    folderPath: entry.folderPath,
    matchType,
    score,
  };
}

function scoreCandidate(normalizedInput, entry) {
  const inputTokens = toTokenSet(normalizedInput);
  let bestScore = 0;

  for (const alias of entry.aliases) {
    const aliasTokens = toTokenSet(alias);
    const score = sorensenDice(inputTokens, aliasTokens);
    bestScore = Math.max(bestScore, score);
  }

  return bestScore;
}

function sorensenDice(leftTokens, rightTokens) {
  if (leftTokens.size === 0 || rightTokens.size === 0) {
    return 0;
  }

  let common = 0;

  for (const token of leftTokens) {
    if (rightTokens.has(token)) {
      common += 1;
    }
  }

  return (2 * common) / (leftTokens.size + rightTokens.size);
}

function toTokenSet(value) {
  return new Set(
    normalizeLoose(value)
      .split(/\s+/)
      .map((token) => token.trim())
      .filter(Boolean),
  );
}

function toCompactKey(value) {
  return normalizeLoose(value).replace(/[^a-z0-9]/g, "");
}

function findEmbeddedCatalogMatch(catalog, inputName, { useCompact }) {
  const tokens = normalizeLoose(inputName)
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .slice(0, EMBEDDED_TOKEN_LIMIT);

  let bestMatch = null;

  for (let start = 0; start < tokens.length; start += 1) {
    for (let width = 1; width <= EMBEDDED_NGRAM_WORD_LIMIT && start + width <= tokens.length; width += 1) {
      const candidate = tokens.slice(start, start + width).join(" ");
      const entry = useCompact
        ? catalog.find((item) => item.compactAliases.has(toCompactKey(candidate)))
        : catalog.find((item) => item.aliases.has(candidate));

      if (!entry) {
        continue;
      }

      const score = width + (tokens.length - start) / 100;

      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { entry, score };
      }
    }
  }

  return bestMatch;
}

function similarityScore(left, right) {
  const leftValue = String(left ?? "");
  const rightValue = String(right ?? "");

  if (!leftValue || !rightValue) {
    return 0;
  }

  if (leftValue === rightValue) {
    return 1;
  }

  const maxLength = Math.max(leftValue.length, rightValue.length);
  const distance = levenshteinDistance(leftValue, rightValue);
  return Math.max(0, 1 - distance / maxLength);
}

function levenshteinDistance(left, right) {
  const rows = left.length + 1;
  const cols = right.length + 1;
  const matrix = Array.from({ length: rows }, () => Array.from({ length: cols }, () => 0));

  for (let row = 0; row < rows; row += 1) {
    matrix[row][0] = row;
  }

  for (let col = 0; col < cols; col += 1) {
    matrix[0][col] = col;
  }

  for (let row = 1; row < rows; row += 1) {
    for (let col = 1; col < cols; col += 1) {
      const substitutionCost = left[row - 1] === right[col - 1] ? 0 : 1;
      matrix[row][col] = Math.min(
        matrix[row - 1][col] + 1,
        matrix[row][col - 1] + 1,
        matrix[row - 1][col - 1] + substitutionCost,
      );
    }
  }

  return matrix[rows - 1][cols - 1];
}

function normalizeLoose(value) {
  return normalizeName(String(value ?? ""))
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
