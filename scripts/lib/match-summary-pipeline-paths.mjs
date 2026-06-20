import { basename, resolve } from "node:path";

export const DEFAULT_MATCH_SUMMARY_OUTPUT_ROOT = "generated/match-summary-ingest";
export const FORMATION_EXPORT_DIRECTORY = "formation-exports";
export const SHIRT_NUMBER_UPDATE_DIRECTORY = "shirt-number-updates";
export const FORMATION_DESTINATION_FILE = "country-formation-input.json";
const MAX_ARTIFACT_SLUG_LENGTH = 64;

export function getTeamArtifactIdentity(teamArtifact, { artifactPath = null } = {}) {
  const teamName = String(teamArtifact?.team?.name ?? "").trim();
  const teamSlug = resolveSafeTeamSlug(teamArtifact, { artifactPath, teamName });
  const matchId = String(teamArtifact?.match_id ?? "").trim() || inferMatchId(artifactPath);
  const teamFolder = teamArtifact?.team?.resolution?.folder ?? teamArtifact?.team?.folder ?? null;

  return {
    match_id: matchId,
    team_name: teamName || null,
    team_slug: teamSlug,
    team_folder: teamFolder,
    artifact_base_name: `${matchId}-${teamSlug}`,
  };
}

export function getFormationExportOutputPath({ outputRoot, teamArtifact, artifactPath = null }) {
  const identity = getTeamArtifactIdentity(teamArtifact, { artifactPath });
  return resolve(outputRoot, `${identity.artifact_base_name}.formation-input.json`);
}

export function getShirtNumberOutputPath({ outputDir, teamArtifact, artifactPath = null }) {
  const identity = getTeamArtifactIdentity(teamArtifact, { artifactPath });
  return resolve(outputDir, `${identity.artifact_base_name}.shirt-numbers.json`);
}

export function getCanonicalFormationOutputPath({ samplesRoot, teamArtifact, artifactPath = null }) {
  const identity = getTeamArtifactIdentity(teamArtifact, { artifactPath });

  if (!identity.team_folder) {
    throw new Error(
      `Team artifact ${artifactPath ?? identity.artifact_base_name} does not resolve to a canonical samples/teams folder.`,
    );
  }

  return resolve(samplesRoot, identity.team_folder, FORMATION_DESTINATION_FILE);
}

export function normalizePath(filePath) {
  return String(filePath ?? "").replaceAll("\\", "/");
}

export function resolveSafeTeamSlug(teamArtifact, { artifactPath = null, teamName = null } = {}) {
  const resolutionSlug = teamArtifact?.team?.resolution?.resolved
    ? String(teamArtifact.team.resolution.slug ?? "").trim()
    : "";
  const explicitSlug = String(teamArtifact?.team?.slug ?? "").trim();
  const inferredSlug = artifactPath ? inferTeamSlug(artifactPath) : "";

  for (const candidate of [resolutionSlug, explicitSlug, inferredSlug]) {
    if (isSafeArtifactSlug(candidate)) {
      return candidate;
    }
  }

  throw new Error(`Cannot derive a safe team slug${teamName ? ` for \"${summarizeValue(teamName)}\"` : ""}.`);
}

export function isSafeArtifactSlug(value) {
  const slug = String(value ?? "").trim();
  return Boolean(slug) && slug.length <= MAX_ARTIFACT_SLUG_LENGTH && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

function inferMatchId(artifactPath) {
  const fileName = basename(String(artifactPath ?? ""));

  if (fileName.endsWith(".team.json")) {
    const stem = fileName.slice(0, -".team.json".length);
    const lastDash = stem.lastIndexOf("-");
    return lastDash > 0 ? stem.slice(0, lastDash) : stem || "match-summary";
  }

  return "match-summary";
}

function inferTeamSlug(artifactPath) {
  const fileName = basename(String(artifactPath ?? ""));

  if (fileName.endsWith(".team.json")) {
    const stem = fileName.slice(0, -".team.json".length);
    const lastDash = stem.lastIndexOf("-");
    return lastDash > 0 ? stem.slice(lastDash + 1) : stem || "team";
  }

  return "team";
}

function summarizeValue(value) {
  const normalized = String(value ?? "").replace(/\s+/g, " ").trim();
  return normalized.length > 48 ? `${normalized.slice(0, 45)}...` : normalized;
}
