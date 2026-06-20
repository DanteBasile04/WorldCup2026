import { createFormationDocument, getFormationLayout, SUPPORTED_FORMATIONS } from "./formation-svg.mjs";
import { resolveTeamSlug } from "./team-slug-resolver.mjs";

const POSITION_TO_ROLE = new Map([
  ["GK", "GK"],
  ["DF", "DF"],
  ["DEF", "DF"],
  ["MF", "MF"],
  ["MID", "MF"],
  ["FW", "FW"],
  ["FWD", "FW"],
  ["WF", "FW"],
  ["ATT", "FW"],
]);

const ROLE_FALLBACK_PRIORITY = Object.freeze(["GK", "DF", "MF", "FW"]);
const FORMATION_FALLBACK_PRIORITY = Object.freeze([
  "4-3-3",
  "4-2-3-1",
  "4-4-2",
  "5-3-2",
  "5-2-3",
  "3-4-3",
  "3-5-2",
  "4-1-4-1",
  "4-4-1-1",
  "4-3-1-2",
  "4-2-2-2",
  "4-1-2-3",
  "3-2-4-1",
]);

const MAX_SAFE_SUBSTITUTE_PROMOTIONS = 2;
const MAX_REASONABLE_SHIRT_NUMBER = 40;
const POSITION_TOKEN_PATTERN = /\b(GK|DF|DEF|MF|MID|FW|FWD|WF|ATT)\b/i;
const EMBEDDED_POSITION_AND_NUMBER_PATTERN = /\b(GK|DF|DEF|MF|MID|FW|FWD|WF|ATT)\b\s*(\d{1,2})(?:\s*\(\d+\))?/i;
const TRAILING_ANNOTATION_PATTERN = /\s+[+§©\[\]|()'"`0-9:-].*$/;
const MULTISPACE_PATTERN = /\s+/g;

export function exportTeamArtifactToFormationInput(teamArtifact) {
  const team = teamArtifact?.team;
  const teamName = String(team?.name ?? "").trim();

  if (!teamName) {
    throw new Error("Team artifact is missing team.name.");
  }

  const resolution = team?.resolution?.resolved ? team.resolution : resolveTeamSlug(teamName);
  const country = {
    slug: resolution?.resolved ? resolution.slug : String(team?.slug ?? "").trim() || null,
    name: resolution?.resolved ? resolution.name : teamName,
  };

  if (!country.slug && !country.name) {
    throw new Error(`Team artifact for ${teamName} could not resolve country metadata.`);
  }

  const repairedTeam = repairTeamArtifactForFormation(teamArtifact, teamName);
  const players = repairedTeam.assignments.map(({ candidate, slot }) => normalizeAssignedPlayer(candidate, slot, teamName));
  const formationInput = {
    country,
    team: {
      name: teamName,
      formation: repairedTeam.formation,
    },
    players,
  };

  if (teamArtifact?.match) {
    formationInput.match = {
      ...teamArtifact.match,
      match_id: teamArtifact.match_id ?? null,
      side: teamArtifact.side ?? null,
    };
  }

  if (repairedTeam.warnings.length > 0 || repairedTeam.actions.length > 0) {
    formationInput.source = {
      team_artifact_match_id: teamArtifact?.match_id ?? null,
      team_artifact_side: teamArtifact?.side ?? null,
      parsed_match_path: teamArtifact?.source?.parsed_match_path ?? null,
      heuristic_repairs: repairedTeam.actions,
      warnings: repairedTeam.warnings,
    };
  }

  createFormationDocument(formationInput);

  return formationInput;
}

function repairTeamArtifactForFormation(teamArtifact, teamName) {
  const team = teamArtifact?.team ?? {};
  const starters = Array.isArray(team.starters) ? team.starters : [];
  const substitutes = Array.isArray(team.substitutes) ? team.substitutes : [];
  const explicitFormation = normalizeFormation(team.formation);
  const starterCandidates = starters
    .map((player, index) => normalizePlayerCandidate(player, { source: "starter", index, teamName }))
    .filter((candidate) => candidate.valid);
  const substituteCandidates = substitutes
    .map((player, index) => normalizePlayerCandidate(player, { source: "substitute", index, teamName }))
    .filter((candidate) => candidate.valid);
  const candidatePool = [...starterCandidates, ...substituteCandidates];

  if (candidatePool.length < 11) {
    throw new Error(`Team artifact for ${teamName} does not provide enough usable players for a safe repair.`);
  }

  const formationCandidates = buildFormationCandidates(explicitFormation);
  const repairCandidates = [];

  for (const formation of formationCandidates) {
    const selection = selectAssignmentsForFormation({
      formation,
      starterCandidates,
      substituteCandidates,
      teamName,
    });

    if (!selection.ok) {
      continue;
    }

    if (selection.substitutePromotions > MAX_SAFE_SUBSTITUTE_PROMOTIONS) {
      continue;
    }

    const score =
      (formation === explicitFormation ? 100000 : 0) +
      selection.starterCount * 1000 -
      selection.substitutePromotions * 120 -
      selection.recoveredRoleCount * 10 -
      selection.recoveredNumberCount * 6 -
      selection.noisePenalty -
      formationPriorityIndex(formation);

    repairCandidates.push({
      formation,
      selection,
      score,
    });
  }

  const bestRepair = repairCandidates.sort((left, right) => right.score - left.score)[0] ?? null;

  if (!bestRepair) {
    if (!explicitFormation) {
      throw new Error(`Team artifact for ${teamName} is missing team.formation.`);
    }

    if (starterCandidates.length !== 11) {
      throw new Error(`Team artifact for ${teamName} must contain exactly 11 starters; received ${starterCandidates.length}.`);
    }

    throw new Error(`Team artifact for ${teamName} could not be repaired safely for formation export.`);
  }

  const warnings = [
    ...collectSelectedWarnings(bestRepair.selection.assignments),
    ...buildRepairWarnings({
      explicitFormation,
      chosenFormation: bestRepair.formation,
      selection: bestRepair.selection,
      teamName,
    }),
  ];

  return {
    formation: bestRepair.formation,
    assignments: bestRepair.selection.assignments,
    warnings: dedupeStrings(warnings),
    actions: bestRepair.selection.actions,
  };
}

function normalizeAssignedPlayer(candidate, slot, teamName) {
  if (!Number.isInteger(candidate.number)) {
    throw new Error(`Starter slot ${slot} for ${teamName} is missing a valid shirt_number.`);
  }

  if (!candidate.name) {
    throw new Error(`Starter ${candidate.number} for ${teamName} is missing a name.`);
  }

  if (!candidate.role) {
    throw new Error(`Starter ${candidate.number} (${candidate.name}) for ${teamName} is missing position.`);
  }

  return {
    number: candidate.number,
    name: candidate.name,
    position: candidate.position,
    role: candidate.role,
    slot,
  };
}

function normalizePlayerCandidate(player, { source, index, teamName }) {
  const rawNumber = Number.parseInt(player?.shirt_number, 10);
  const rawPosition = String(player?.position ?? "").trim().toUpperCase();
  const rawName = String(player?.name ?? "").replace(MULTISPACE_PATTERN, " ").trim();
  const warnings = [];
  let number = Number.isInteger(rawNumber) ? rawNumber : null;
  let role = POSITION_TO_ROLE.get(rawPosition) ?? null;

  const embeddedPositionMatch = rawName.match(POSITION_TOKEN_PATTERN);
  const embeddedPositionAndNumberMatch = rawName.match(EMBEDDED_POSITION_AND_NUMBER_PATTERN);

  if (!role && embeddedPositionMatch) {
    role = POSITION_TO_ROLE.get(embeddedPositionMatch[1].toUpperCase()) ?? null;

    if (role) {
      warnings.push(`${source} player ${displayPlayerForWarning(player)} recovered role ${role} from OCR text.`);
    }
  }

  if (
    embeddedPositionAndNumberMatch &&
    (number == null || number > MAX_REASONABLE_SHIRT_NUMBER)
  ) {
    const recoveredNumber = Number.parseInt(embeddedPositionAndNumberMatch[2], 10);

    if (Number.isInteger(recoveredNumber)) {
      number = recoveredNumber;
      warnings.push(`${source} player ${displayPlayerForWarning(player)} recovered shirt number ${recoveredNumber} from OCR text.`);
    }
  }

  const cleanedName = cleanPlayerName(rawName, role);
  const position = roleToPosition(role);
  const valid = Number.isInteger(number) && Boolean(cleanedName) && Boolean(role);

  return {
    id: `${source}:${index}:${number ?? "na"}:${cleanedName || rawName || "unknown"}`,
    source,
    sourceIndex: index,
    rawNumber,
    number,
    rawPosition,
    position,
    role,
    rawName,
    name: cleanedName,
    valid,
    warnings,
    recoveredRole: !POSITION_TO_ROLE.get(rawPosition) && Boolean(role),
    recoveredNumber: number !== rawNumber,
    noisePenalty: estimateNoisePenalty(rawName),
    teamName,
  };
}

function selectAssignmentsForFormation({ formation, starterCandidates, substituteCandidates, teamName }) {
  const layout = getFormationLayout(formation);
  const pool = [...starterCandidates, ...substituteCandidates];
  const orderedSlots = orderLayoutSlots(layout, pool);
  const usedCandidateIds = new Set();
  const usedNumbers = new Set();
  const assignmentsBySlot = new Map();

  for (const position of orderedSlots) {
    const candidates = pool
      .filter((candidate) => !usedCandidateIds.has(candidate.id))
      .filter((candidate) => !usedNumbers.has(candidate.number))
      .filter((candidate) => position.acceptedRoles.includes(candidate.role))
      .sort((left, right) => scoreCandidateForSlot(right, position) - scoreCandidateForSlot(left, position));

    const candidate = candidates[0] ?? null;

    if (!candidate) {
      return {
        ok: false,
        reason: `Could not assign a player to slot ${position.slot}.`,
      };
    }

    usedCandidateIds.add(candidate.id);
    usedNumbers.add(candidate.number);
    assignmentsBySlot.set(position.slot, {
      slot: position.slot,
      positionRole: position.role,
      candidate,
    });
  }

  const assignments = layout.map((position) => assignmentsBySlot.get(position.slot));
  const starterCount = assignments.filter(({ candidate }) => candidate.source === "starter").length;
  const substitutePromotions = assignments.filter(({ candidate }) => candidate.source === "substitute").length;
  const recoveredRoleCount = assignments.filter(({ candidate }) => candidate.recoveredRole).length;
  const recoveredNumberCount = assignments.filter(({ candidate }) => candidate.recoveredNumber).length;
  const noisePenalty = assignments.reduce((total, { candidate }) => total + candidate.noisePenalty, 0);
  const actions = buildSelectionActions({
    assignments,
    starterCandidates,
    formation,
    teamName,
  });

  return {
    ok: true,
    assignments,
    starterCount,
    substitutePromotions,
    recoveredRoleCount,
    recoveredNumberCount,
    noisePenalty,
    actions,
  };
}

function buildFormationCandidates(explicitFormation) {
  const supported = new Set(SUPPORTED_FORMATIONS);
  const ordered = [];

  if (explicitFormation && supported.has(explicitFormation)) {
    ordered.push(explicitFormation);
  }

  for (const formation of FORMATION_FALLBACK_PRIORITY) {
    if (supported.has(formation) && !ordered.includes(formation)) {
      ordered.push(formation);
    }
  }

  for (const formation of SUPPORTED_FORMATIONS) {
    if (!ordered.includes(formation)) {
      ordered.push(formation);
    }
  }

  return ordered;
}

function orderLayoutSlots(layout, pool) {
  return [...layout].sort((left, right) => {
    const leftAvailability = countCandidatesForSlot(left, pool);
    const rightAvailability = countCandidatesForSlot(right, pool);

    return (
      left.acceptedRoles.length - right.acceptedRoles.length ||
      leftAvailability - rightAvailability ||
      rolePriorityIndex(left.role) - rolePriorityIndex(right.role) ||
      left.slot.localeCompare(right.slot, "en")
    );
  });
}

function countCandidatesForSlot(position, pool) {
  return pool.filter((candidate) => position.acceptedRoles.includes(candidate.role)).length;
}

function scoreCandidateForSlot(candidate, position) {
  const exactRoleBonus = candidate.role === position.role ? 80 : 20;
  const sourceBonus = candidate.source === "starter" ? 1000 : 0;
  const cleanNameBonus = Math.max(0, 60 - candidate.noisePenalty);
  const recoveredPenalty = (candidate.recoveredRole ? 12 : 0) + (candidate.recoveredNumber ? 8 : 0);

  return sourceBonus + exactRoleBonus + cleanNameBonus - recoveredPenalty - candidate.sourceIndex;
}

function buildSelectionActions({ assignments, starterCandidates, formation, teamName }) {
  const selectedStarterIds = new Set(
    assignments
      .filter(({ candidate }) => candidate.source === "starter")
      .map(({ candidate }) => candidate.id),
  );
  const promotedSubstitutes = assignments
    .filter(({ candidate }) => candidate.source === "substitute")
    .map(({ candidate, slot }) => `${candidate.number} ${candidate.name} -> ${slot}`);
  const droppedStarters = starterCandidates
    .filter((candidate) => !selectedStarterIds.has(candidate.id))
    .map((candidate) => `${candidate.number} ${candidate.name}`);
  const actions = [];

  if (promotedSubstitutes.length > 0) {
    actions.push(`Promoted substitutes for ${teamName} ${formation}: ${promotedSubstitutes.join(", ")}.`);
  }

  if (droppedStarters.length > 0) {
    actions.push(`Omitted lower-confidence starter rows for ${teamName}: ${droppedStarters.join(", ")}.`);
  }

  return actions;
}

function buildRepairWarnings({ explicitFormation, chosenFormation, selection, teamName }) {
  const warnings = [];

  if (!explicitFormation) {
    warnings.push(`Formation for ${teamName} was inferred heuristically as ${chosenFormation}.`);
  } else if (explicitFormation !== chosenFormation) {
    warnings.push(`Formation for ${teamName} was repaired from ${explicitFormation} to ${chosenFormation} for export safety.`);
  }

  if (selection.substitutePromotions > 0) {
    warnings.push(
      `Formation export for ${teamName} promoted ${selection.substitutePromotions} substitute${selection.substitutePromotions === 1 ? "" : "s"} to complete 11 players.`,
    );
  }

  if (selection.recoveredRoleCount > 0) {
    warnings.push(`Formation export for ${teamName} recovered ${selection.recoveredRoleCount} player role value${selection.recoveredRoleCount === 1 ? "" : "s"} from OCR text.`);
  }

  if (selection.recoveredNumberCount > 0) {
    warnings.push(`Formation export for ${teamName} recovered ${selection.recoveredNumberCount} shirt number value${selection.recoveredNumberCount === 1 ? "" : "s"} from OCR text.`);
  }

  return warnings;
}

function collectSelectedWarnings(assignments) {
  return assignments.flatMap(({ candidate }) => candidate.warnings);
}

function normalizeFormation(value) {
  const formation = String(value ?? "").trim();
  return formation || null;
}

function roleToPosition(role) {
  if (!role) {
    return null;
  }

  return role;
}

function cleanPlayerName(rawName, role) {
  let cleaned = String(rawName ?? "").replace(MULTISPACE_PATTERN, " ").trim();

  if (!cleaned) {
    return "";
  }

  if (role) {
    cleaned = cleaned
      .replace(new RegExp(`^${role}\\s+`, "i"), "")
      .replace(EMBEDDED_POSITION_AND_NUMBER_PATTERN, "")
      .replace(POSITION_TOKEN_PATTERN, " ");
  }

  cleaned = cleaned
    .replace(TRAILING_ANNOTATION_PATTERN, "")
    .replace(/\b\d{1,2}(?:\s*\(\d+\))?$/, "")
    .replace(MULTISPACE_PATTERN, " ")
    .trim();

  return cleaned;
}

function estimateNoisePenalty(value) {
  const text = String(value ?? "");
  const noiseMatches = text.match(/[§©\[\]|+"'`]/g) ?? [];
  return noiseMatches.length * 6 + (text.length > 28 ? 4 : 0);
}

function displayPlayerForWarning(player) {
  const number = Number.parseInt(player?.shirt_number, 10);
  const name = String(player?.name ?? "").replace(MULTISPACE_PATTERN, " ").trim();

  if (Number.isInteger(number) && name) {
    return `${number} ${name}`;
  }

  return name || `row ${JSON.stringify(player)}`;
}

function rolePriorityIndex(role) {
  const index = ROLE_FALLBACK_PRIORITY.indexOf(role);
  return index === -1 ? ROLE_FALLBACK_PRIORITY.length : index;
}

function formationPriorityIndex(formation) {
  const index = FORMATION_FALLBACK_PRIORITY.indexOf(formation);
  return index === -1 ? FORMATION_FALLBACK_PRIORITY.length : index;
}

function dedupeStrings(values) {
  return Array.from(new Set(values.filter(Boolean)));
}
