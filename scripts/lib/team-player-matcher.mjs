import {
  normalizePlayerNameForMatching,
  toCompactPlayerNameKey,
  tokenizePlayerName,
} from "./player-name-normalizer.mjs";

export function matchCapturedPlayersToRoster({ teamSlug, capturedPlayers, rosterPlayers }) {
  if (!Array.isArray(capturedPlayers)) {
    throw new Error("capturedPlayers must be an array.");
  }

  if (!Array.isArray(rosterPlayers)) {
    throw new Error("rosterPlayers must be an array.");
  }

  const warnings = [];
  const updates = [];
  const unresolved = [];
  const usedRosterPlayerIds = new Set();
  const rosterEntries = rosterPlayers.map((player, index) => buildRosterEntry(player, index));

  if (!String(teamSlug ?? "").trim()) {
    warnings.push("Team slug was not provided to the matcher.");
  }

  for (const capturedPlayer of capturedPlayers) {
    const captured = normalizeCapturedPlayer(capturedPlayer);

    if (!captured.captured_name) {
      unresolved.push({
        captured_name: captured.captured_name,
        shirt_number: captured.shirt_number,
        captured_position: captured.captured_position,
        reason: "Captured player name is empty.",
      });
      continue;
    }

    const exactCandidates = rosterEntries.filter((entry) => entry.rawName === captured.captured_name);
    const exactMatch = selectSingleCandidate(exactCandidates, "exact", captured, warnings);

    if (exactMatch) {
      if (registerMatch(exactMatch, captured, "exact", updates, unresolved, warnings, usedRosterPlayerIds)) {
        continue;
      }
    }

    const normalizedCandidates = rosterEntries.filter((entry) => entry.normalizedName === captured.normalizedName);
    const normalizedMatch = selectSingleCandidate(normalizedCandidates, "normalized", captured, warnings);

    if (normalizedMatch) {
      if (registerMatch(normalizedMatch, captured, "normalized", updates, unresolved, warnings, usedRosterPlayerIds)) {
        continue;
      }
    }

    const fuzzyMatch = findSafeFuzzyMatch(captured, rosterEntries);

    if (fuzzyMatch) {
      if (registerMatch(fuzzyMatch.entry, captured, "fuzzy", updates, unresolved, warnings, usedRosterPlayerIds)) {
        continue;
      }
    }

    unresolved.push({
      captured_name: captured.captured_name,
      shirt_number: captured.shirt_number,
      captured_position: captured.captured_position,
      reason: "No roster player matched within the same team.",
    });
  }

  return { updates, unresolved, warnings };
}

function buildRosterEntry(player, index) {
  const rawName = String(player?.name ?? "").trim();

  if (!rawName) {
    throw new Error(`Roster player at index ${index} is missing name.`);
  }

  return {
    player,
    id: player?.id ?? rawName,
    rawName,
    normalizedName: normalizePlayerNameForMatching(rawName),
    compactName: toCompactPlayerNameKey(rawName),
    tokens: tokenizePlayerName(rawName),
  };
}

function normalizeCapturedPlayer(player) {
  const capturedName = String(player?.captured_name ?? player?.name ?? "").trim();
  const rawNumber = player?.shirt_number ?? player?.number ?? null;
  const parsedNumber = rawNumber == null || rawNumber === ""
    ? null
    : Number.parseInt(rawNumber, 10);

  return {
    captured_name: capturedName,
    normalizedName: normalizePlayerNameForMatching(capturedName),
    compactName: toCompactPlayerNameKey(capturedName),
    tokens: tokenizePlayerName(capturedName),
    shirt_number: Number.isInteger(parsedNumber) ? parsedNumber : null,
    captured_position: player?.captured_position ?? player?.position ?? null,
  };
}

function selectSingleCandidate(candidates, strategy, captured, warnings) {
  if (candidates.length === 1) {
    return candidates[0];
  }

  if (candidates.length > 1) {
    warnings.push(
      `Ambiguous ${strategy} match for \"${captured.captured_name}\": ${candidates.map((candidate) => candidate.rawName).join(", ")}.`,
    );
  }

  return null;
}

function registerMatch(entry, captured, strategy, updates, unresolved, warnings, usedRosterPlayerIds) {
  if (usedRosterPlayerIds.has(entry.id)) {
    warnings.push(
      `Roster player \"${entry.rawName}\" was matched more than once inside the same team artifact.`,
    );
    unresolved.push({
      captured_name: captured.captured_name,
      shirt_number: captured.shirt_number,
      captured_position: captured.captured_position,
      reason: `Roster player \"${entry.rawName}\" was already matched earlier in this artifact.`,
    });
    return true;
  }

  usedRosterPlayerIds.add(entry.id);
  updates.push({
    captured_name: captured.captured_name,
    shirt_number: captured.shirt_number,
    matched_player_id: entry.player.id ?? null,
    matched_player_name: entry.rawName,
    match_strategy: strategy,
  });
  return true;
}

function findSafeFuzzyMatch(captured, rosterEntries) {
  if (!captured.compactName || captured.compactName.length < 5) {
    return null;
  }

  const scored = rosterEntries
    .map((entry) => scoreCandidate(captured, entry))
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score);

  const best = scored[0];
  const second = scored[1] ?? null;

  if (!best) {
    return null;
  }

  const hasSafeGap = !second || best.score - second.score >= 0.04;
  const safeTokenDelta = Math.abs(captured.tokens.length - best.entry.tokens.length) <= 1;

  if (
    best.score >= 0.93 &&
    best.compactScore >= 0.88 &&
    best.surnameScore >= 0.85 &&
    hasSafeGap &&
    safeTokenDelta
  ) {
    return best;
  }

  return null;
}

function scoreCandidate(captured, entry) {
  const compactScore = similarityScore(captured.compactName, entry.compactName);
  const tokenScore = sorensenDice(captured.tokens, entry.tokens);
  const surnameScore = similarityScore(lastToken(captured.tokens), lastToken(entry.tokens));
  const score = compactScore * 0.6 + tokenScore * 0.25 + surnameScore * 0.15;

  return {
    entry,
    compactScore,
    tokenScore,
    surnameScore,
    score,
  };
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

function sorensenDice(leftTokens, rightTokens) {
  const left = new Set(leftTokens);
  const right = new Set(rightTokens);

  if (left.size === 0 || right.size === 0) {
    return 0;
  }

  let common = 0;

  for (const token of left) {
    if (right.has(token)) {
      common += 1;
    }
  }

  return (2 * common) / (left.size + right.size);
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

function lastToken(tokens) {
  return tokens.at(-1) ?? "";
}
