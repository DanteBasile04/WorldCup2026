import { resolveTeamSlug } from "./team-slug-resolver.mjs";

const PARSER_VERSION = "match-summary-parser-v3";

const HEADER_STOP_WORDS = new Set([
  "starting",
  "starting lineup",
  "starters",
  "substitutes",
  "subs",
  "bench",
]);

const PANEL_TITLE_STOP_WORDS = new Set([
  ...HEADER_STOP_WORDS,
  "match summary",
  "match summary - teams",
  "teams",
]);

const TEAM_NAME_SCAN_LIMIT = 8;
const TEAM_NAME_MAX_LENGTH = 48;

const TEAM_RESOLUTION_RANK = new Map([
  ["exact", 5],
  ["compact", 4],
  ["embedded-exact", 3],
  ["embedded-compact", 2],
  ["fuzzy", 1],
]);

const FORMATION_BY_ROLE_COUNTS = new Map([
  ["4|3|3", "4-3-3"],
  ["4|4|2", "4-4-2"],
  ["4|5|1", "4-2-3-1"],
  ["3|4|3", "3-4-3"],
  ["3|5|2", "3-5-2"],
  ["3|6|1", "3-2-4-1"],
  ["5|3|2", "5-3-2"],
  ["5|2|3", "5-2-3"],
]);

const AMBIGUOUS_FORMATION_KEYS = new Set(["4|3|3", "4|4|2", "4|5|1"]);

const ROLE_CODES = new Set(["GK", "DF", "MF", "FW", "WF"]);

export function parseMatchSummary({ layoutVersion, leftText, centerText, rightText, matchId = null }) {
  const warnings = [];
  const centerInfo = parseCenterPanel(centerText);
  const leftPanel = parseTeamPanel(leftText, {
    side: "home",
    panel: "left",
    fallbackName: centerInfo.homeTeamName,
  });
  const rightPanel = parseTeamPanel(rightText, {
    side: "away",
    panel: "right",
    fallbackName: centerInfo.awayTeamName,
  });

  warnings.push(...centerInfo.warnings, ...leftPanel.warnings, ...rightPanel.warnings);

  if (!centerInfo.homeTeamName && leftPanel.name) {
    centerInfo.homeTeamName = leftPanel.name;
  }

  if (!centerInfo.awayTeamName && rightPanel.name) {
    centerInfo.awayTeamName = rightPanel.name;
  }

  if (!centerInfo.homeTeamName) {
    warnings.push("Home team name could not be inferred from center or left panel text.");
  }

  if (!centerInfo.awayTeamName) {
    warnings.push("Away team name could not be inferred from center or right panel text.");
  }

  return {
    schema_version: "match-summary-parsed-v1",
    parser_version: PARSER_VERSION,
    layout_version: layoutVersion,
    match_id: matchId,
    match: {
      home_team_name: centerInfo.homeTeamName,
      away_team_name: centerInfo.awayTeamName,
      home_score: centerInfo.homeScore,
      away_score: centerInfo.awayScore,
      date: centerInfo.date,
      venue: centerInfo.venue,
      competition: centerInfo.competition,
    },
    teams: {
      home: {
        side: "home",
        panel: "left",
        name: leftPanel.name ?? centerInfo.homeTeamName,
        formation: leftPanel.formation,
        starters: leftPanel.starters,
        substitutes: leftPanel.substitutes,
        warnings: leftPanel.warnings,
      },
      away: {
        side: "away",
        panel: "right",
        name: rightPanel.name ?? centerInfo.awayTeamName,
        formation: rightPanel.formation,
        starters: rightPanel.starters,
        substitutes: rightPanel.substitutes,
        warnings: rightPanel.warnings,
      },
    },
    warnings,
  };
}

export function parseTeamName(panelText, fallbackName = null) {
  const lines = toLines(panelText);
  const candidates = buildTeamNameCandidates(lines);
  const resolvedName = resolveBestTeamName(candidates);

  if (resolvedName) {
    return resolvedName;
  }

  const safeFallbackName = toSafeStandaloneTeamName(fallbackName);

  if (safeFallbackName) {
    return safeFallbackName;
  }

  return candidates.find((candidate) => toSafeStandaloneTeamName(candidate)) ?? null;
}

export function parseFormation(panelText) {
  const lines = Array.isArray(panelText) ? panelText : toLines(panelText);

  for (const line of lines) {
    const directMatch = line.match(/formation\s*[:\-]?\s*(\d(?:-\d+){2,5})/i);

    if (directMatch) {
      return directMatch[1];
    }

    const looseMatch = line.match(/\b(\d(?:-\d+){2,5})\b/);

    if (looseMatch) {
      return looseMatch[1];
    }
  }

  return null;
}

export function parseStartingBlock(panelText) {
  return extractBlock(panelText, ["starting", "starting lineup", "starters"], [
    "substitutes",
    "subs",
    "bench",
    "formation",
  ]);
}

export function parseSubstitutesBlock(panelText) {
  return extractBlock(panelText, ["substitutes", "subs", "bench"], ["formation"]);
}

export function parsePlayerLine(line) {
  const trimmed = normalizePlayerParseLine(line);

  if (!trimmed) {
    return { player: null, warning: null };
  }

  const playerMatch = trimmed.match(/^(\d{1,2})\s+([A-Za-z]{1,4})\s+(.+)$/);

  if (playerMatch) {
    return {
      player: {
        shirt_number: Number.parseInt(playerMatch[1], 10),
        position: playerMatch[2].toUpperCase(),
        name: normalizePlayerName(playerMatch[3]),
      },
      warning: null,
    };
  }

  const trailingMatch = trimmed.match(/^(.+?)\s+([A-Za-z]{1,4})\s+(\d{1,2})(?:\s*\(\d+\))?$/);

  if (trailingMatch) {
    return {
      player: {
        shirt_number: Number.parseInt(trailingMatch[3], 10),
        position: trailingMatch[2].toUpperCase(),
        name: normalizePlayerName(stripLeadingTimingNoise(trailingMatch[1])),
      },
      warning: null,
    };
  }

  const compactTrailingMatch = trimmed.match(/^(.+?)\s+([A-Za-z]{1,4})\s*(\d{1,2})(?:\s*\(\d+\))?$/);

  if (compactTrailingMatch && ROLE_CODES.has(compactTrailingMatch[2].toUpperCase())) {
    return {
      player: {
        shirt_number: Number.parseInt(compactTrailingMatch[3], 10),
        position: compactTrailingMatch[2].toUpperCase(),
        name: normalizePlayerName(stripLeadingTimingNoise(compactTrailingMatch[1])),
      },
      warning: null,
    };
  }

  const partialMatch = trimmed.match(/^(\d{1,2})\s+(.+)$/);

  if (partialMatch) {
    return {
      player: {
        shirt_number: Number.parseInt(partialMatch[1], 10),
        position: null,
        name: normalizePlayerName(partialMatch[2]),
      },
      warning: `Player line "${trimmed}" was missing an explicit position code.`,
    };
  }

  return { player: null, warning: null };
}

function parseCenterPanel(centerText) {
  const lines = toLines(centerText);
  const warnings = [];
  let homeTeamName = null;
  let awayTeamName = null;
  let homeScore = null;
  let awayScore = null;
  let date = null;
  let venue = null;
  let competition = null;

  for (const line of lines) {
    const dateVenueLineMatch = line.match(/^(.+?)\s+-\s+(.+?)\s+-\s+(\d{1,2}:\d{2})$/);

    if (dateVenueLineMatch) {
      if (!date) {
        date = dateVenueLineMatch[1].trim();
      }

      if (!venue) {
        venue = dateVenueLineMatch[2].trim();
      }

      continue;
    }

    const scoreMatch = line.match(/^(.+?)\s+(\d+)\s*[-:]\s*(\d+)\s+(.+)$/);

    if (scoreMatch && !homeTeamName && !awayTeamName) {
      homeTeamName = scoreMatch[1].trim();
      homeScore = Number.parseInt(scoreMatch[2], 10);
      awayScore = Number.parseInt(scoreMatch[3], 10);
      awayTeamName = scoreMatch[4].trim();
      continue;
    }

    const versusMatch = line.match(/^(.+?)\s+(?:vs\.?|v)\s+(.+)$/i);

    if (versusMatch && !homeTeamName && !awayTeamName) {
      homeTeamName = versusMatch[1].trim();
      awayTeamName = versusMatch[2].trim();
      continue;
    }

    const dateMatch = line.match(/^date\s*[:\-]\s*(.+)$/i);

    if (dateMatch && !date) {
      date = dateMatch[1].trim();
      continue;
    }

    const venueMatch = line.match(/^venue\s*[:\-]\s*(.+)$/i);

    if (venueMatch && !venue) {
      venue = venueMatch[1].trim();
      continue;
    }

    const competitionMatch = line.match(/^(competition|stage|tournament)\s*[:\-]\s*(.+)$/i);

    if (competitionMatch && !competition) {
      competition = competitionMatch[2].trim();
    }
  }

  if (!homeTeamName || !awayTeamName) {
    warnings.push("Center panel did not provide a complete match title or score line.");
  }

  return {
    homeTeamName,
    awayTeamName,
    homeScore,
    awayScore,
    date,
    venue,
    competition,
    warnings,
  };
}

function parseTeamPanel(panelText, { side, panel, fallbackName }) {
  const warnings = [];
  const lines = toLines(panelText);
  const parsedName = parseTeamName(lines, fallbackName);
  const directFormation = parseFormation(lines);
  const starters = [];
  const substitutes = [];
  const { starterLines, substituteLines } = splitTeamPanelPlayers(lines);

  if (!parsedName) {
    warnings.push(`${panel} panel team name could not be resolved.`);
  }

  for (const line of starterLines) {
    const { player, warning } = parsePlayerLine(line);

    if (warning) warnings.push(warning);
    if (player) starters.push(player);
  }

  for (const line of substituteLines) {
    const { player, warning } = parsePlayerLine(line);

    if (warning) warnings.push(warning);
    if (player) substitutes.push(player);
  }

  let formation = directFormation;

  if (!formation) {
    const inferredFormation = inferFormationFromStarterLines(starterLines, starters);

    if (inferredFormation) {
      formation = inferredFormation.formation;

      if (inferredFormation.warning) {
        warnings.push(inferredFormation.warning);
      }
    }
  }

  if (!formation) {
    warnings.push(`${panel} panel formation was not found.`);
  }

  if (starters.length === 0) {
    warnings.push(`${panel} panel produced zero starting players.`);
  }

  return {
    side,
    panel,
    name: parsedName,
    formation,
    starters,
    substitutes,
    warnings,
  };
}

function extractBlock(panelText, startHeaders, stopHeaders) {
  const lines = Array.isArray(panelText) ? panelText : toLines(panelText);
  const normalizedStartHeaders = new Set(startHeaders.map(normalizeHeader));
  const normalizedStopHeaders = new Set(stopHeaders.map(normalizeHeader));
  const collected = [];
  let inBlock = false;
  let sawHeader = false;
  let nonPlayerGap = 0;

  for (const line of lines) {
    const normalized = normalizeHeader(line);

    if (normalizedStartHeaders.has(normalized)) {
      inBlock = true;
      sawHeader = true;
      nonPlayerGap = 0;
      continue;
    }

    if (inBlock && (normalizedStopHeaders.has(normalized) || /^formation\b/i.test(line))) {
      break;
    }

    if (inBlock) {
      if (isLikelyPlayerLine(line)) {
        collected.push(line);
        nonPlayerGap = 0;
        continue;
      }

      if (collected.length > 0) {
        nonPlayerGap += 1;

        if (nonPlayerGap >= 2) {
          break;
        }
      }
    }
  }

  if (collected.length > 0) {
    return collected;
  }

  if (sawHeader) {
    return [];
  }

  return [];
}

function splitTeamPanelPlayers(lines) {
  const hasStarterHeader = hasAnyHeader(lines, ["starting", "starting lineup", "starters"]);
  const hasSubstituteHeader = hasAnyHeader(lines, ["substitutes", "subs", "bench"]);

  if (hasStarterHeader || hasSubstituteHeader) {
    const starterLines = hasStarterHeader ? parseStartingBlock(lines) : [];
    const substituteLines = hasSubstituteHeader ? parseSubstitutesBlock(lines) : [];

    if (starterLines.length > 11 && substituteLines.length === 0) {
      return {
        starterLines: starterLines.slice(0, 11),
        substituteLines: starterLines.slice(11),
      };
    }

    return { starterLines, substituteLines };
  }

  const implicitLines = collectLikelyPlayerLines(lines);

  if (implicitLines.length <= 11) {
    return {
      starterLines: implicitLines,
      substituteLines: [],
    };
  }

  return {
    starterLines: implicitLines.slice(0, 11),
    substituteLines: implicitLines.slice(11),
  };
}

function hasAnyHeader(lines, headers) {
  const normalizedHeaders = new Set(headers.map(normalizeHeader));
  return lines.some((line) => normalizedHeaders.has(normalizeHeader(line)));
}

function collectLikelyPlayerLines(lines) {
  return lines.filter((line) => isLikelyPlayerLine(line));
}

function inferFormationFromStarterLines(starterLines, parsedStarters) {
  if (starterLines.length !== 11) {
    return null;
  }

  const roles = parsedStarters.length === 11
    ? parsedStarters.map((player) => normalizeRoleCode(player.position)).filter(Boolean)
    : starterLines.map(extractRoleCode).filter(Boolean);

  if (roles.length !== 11 || roles.filter((role) => role === "GK").length !== 1) {
    return null;
  }

  const defenders = roles.filter((role) => role === "DF").length;
  const midfielders = roles.filter((role) => role === "MF").length;
  const forwards = roles.filter((role) => role === "FW").length;

  if (defenders + midfielders + forwards !== 10) {
    return null;
  }

  const key = `${defenders}|${midfielders}|${forwards}`;
  const formation = FORMATION_BY_ROLE_COUNTS.get(key) ?? null;

  if (!formation) {
    return null;
  }

  return {
    formation,
    warning: AMBIGUOUS_FORMATION_KEYS.has(key)
      ? `Formation was inferred as ${formation} from starter role counts only; exact line splits may still need manual review.`
      : null,
  };
}

function extractRoleCode(line) {
  const normalized = normalizePlayerParseLine(line);
  const directMatch = normalized.match(/\b(GK|DF|MF|FW|WF)\b/i);

  if (directMatch) {
    return normalizeRoleCode(directMatch[1]);
  }

  const leadingMatch = normalized.match(/^(GK|DF|MF|FW|WF)(?=\s|[A-Z])/i);
  return normalizeRoleCode(leadingMatch?.[1] ?? null);
}

function normalizeRoleCode(value) {
  const upper = String(value ?? "").toUpperCase();

  if (upper === "WF") {
    return "FW";
  }

  return ROLE_CODES.has(upper) ? upper : null;
}

function normalizeHeader(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[:\-]+$/g, "");
}

function normalizePlayerName(value) {
  return stripLeadingTimingNoise(String(value ?? "")).replace(/\s+/g, " ").trim();
}

function toLines(value) {
  if (Array.isArray(value)) {
    return value.map((line) => String(line ?? "").trim()).filter(Boolean);
  }

  return String(value ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function buildTeamNameCandidates(lines) {
  const topLines = extractTopPanelLines(lines);
  const cleaned = topLines.map(cleanTeamTitleLine).filter(Boolean);
  const candidates = [];

  for (const line of cleaned) {
    pushUnique(candidates, line);
  }

  for (let start = 0; start < cleaned.length; start += 1) {
    for (let width = 2; width <= 3 && start + width <= cleaned.length; width += 1) {
      pushUnique(candidates, cleaned.slice(start, start + width).join(" "));
    }
  }

  return candidates;
}

function extractTopPanelLines(lines) {
  const collected = [];

  for (const line of lines.slice(0, TEAM_NAME_SCAN_LIMIT)) {
    if (isLikelyPlayerLine(line)) {
      break;
    }

    collected.push(line);
  }

  return collected.length > 0 ? collected : lines.slice(0, TEAM_NAME_SCAN_LIMIT);
}

function cleanTeamTitleLine(line) {
  const raw = String(line ?? "").trim();

  if (!raw) {
    return null;
  }

  const normalized = normalizeHeader(raw);

  if (PANEL_TITLE_STOP_WORDS.has(normalized)) {
    return null;
  }

  if (parseFormation(raw) || isLikelyPlayerLine(raw)) {
    return null;
  }

  const cleaned = raw
    .replace(/^[^\p{L}\p{N}]+/gu, "")
    .replace(/[^\p{L}\p{N}]+$/gu, "")
    .replace(/\s+/g, " ")
    .trim();

  return /[A-Za-z]/.test(cleaned) ? cleaned : null;
}

function resolveBestTeamName(candidates) {
  const matches = candidates
    .map((candidate, index) => ({
      candidate,
      index,
      resolution: resolveTeamSlug(candidate),
    }))
    .filter(({ resolution }) => resolution.resolved)
    .sort((left, right) => {
      const rankDelta = (TEAM_RESOLUTION_RANK.get(right.resolution.matchType) ?? 0)
        - (TEAM_RESOLUTION_RANK.get(left.resolution.matchType) ?? 0);

      if (rankDelta !== 0) {
        return rankDelta;
      }

      if (right.resolution.score !== left.resolution.score) {
        return right.resolution.score - left.resolution.score;
      }

      if (left.candidate.length !== right.candidate.length) {
        return left.candidate.length - right.candidate.length;
      }

      return left.index - right.index;
    });

  return matches[0]?.resolution.name ?? null;
}

function toSafeStandaloneTeamName(value) {
  const candidate = cleanTeamTitleLine(value);

  if (!candidate || candidate.length > TEAM_NAME_MAX_LENGTH || /\d/.test(candidate)) {
    return null;
  }

  const words = candidate.split(/\s+/).filter(Boolean);
  const shortWordCount = words.filter((word) => word.length === 1).length;

  if (words.length === 0 || words.length > 5 || shortWordCount > 1) {
    return null;
  }

  return candidate;
}

function isLikelyPlayerLine(line) {
  const cleaned = normalizePlayerParseLine(line);

  return /^(\d{1,2})\s+[A-Za-z]{1,4}\s+.+$/.test(cleaned)
    || /^.+\s+[A-Za-z]{1,4}\s+\d{1,2}(?:\s*\(\d+\))?$/.test(cleaned)
    || (/\b(?:GK|DF|MF|FW|WF)\b/i.test(cleaned) && /\b\d{1,2}\b/.test(cleaned));
}

function normalizePlayerParseLine(value) {
  return String(value ?? "")
    .replace(/^[^\p{L}\p{N}]+/gu, "")
    .replace(/(\d)(GK|DF|MF|FW|WF)\b/gi, "$1 $2")
    .replace(/\b(GK|DF|MF|FW|WF)(?=[A-Z])/gi, "$1 ")
    .replace(/\b(GK|DF|MF|FW|WF)\s*(\d{1,2})(?=\b|\s*\()/gi, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
}

function stripLeadingTimingNoise(value) {
  return String(value ?? "")
    .replace(/^(?:\d{1,2}\s*(?:\d{1,2})?[+°'"|§&.,-]*\s*)+/u, "")
    .replace(/^[^\p{L}\p{N}]+/gu, "")
    .trim();
}

function pushUnique(items, value) {
  if (value && !items.includes(value)) {
    items.push(value);
  }
}
