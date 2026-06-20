import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createFormationDocument } from "./formation-svg.mjs";
import {
  FORMATION_EXPORT_DIRECTORY,
  SHIRT_NUMBER_UPDATE_DIRECTORY,
  getFormationExportOutputPath,
  normalizePath,
} from "./match-summary-pipeline-paths.mjs";

export function validateParsedMatchArtifact(artifact, { filePath = null } = {}) {
  const errors = [];
  const warnings = [];

  if (!isRecord(artifact)) {
    errors.push(issue("parsed_match_not_object", "Parsed match artifact must be an object."));
    return createValidationResult("parsed-match", filePath, errors, warnings);
  }

  if (artifact.schema_version !== "match-summary-parsed-v1") {
    warnings.push(
      issue(
        "unexpected_schema_version",
        `Expected schema_version \"match-summary-parsed-v1\" but received ${formatValue(artifact.schema_version)}.`,
      ),
    );
  }

  if (!isNonEmptyString(artifact.parser_version)) {
    warnings.push(issue("missing_parser_version", "Parsed match artifact is missing parser_version."));
  }

  if (!isNonEmptyString(artifact.match_id)) {
    errors.push(issue("missing_match_id", "Parsed match artifact is missing match_id."));
  }

  if (!isRecord(artifact.match)) {
    errors.push(issue("missing_match_payload", "Parsed match artifact is missing match."));
  } else {
    if (!isNonEmptyString(artifact.match.home_team_name)) {
      warnings.push(issue("missing_home_team_name", "Parsed match artifact is missing match.home_team_name."));
    }

    if (!isNonEmptyString(artifact.match.away_team_name)) {
      warnings.push(issue("missing_away_team_name", "Parsed match artifact is missing match.away_team_name."));
    }

    if (!isIntegerLike(artifact.match.home_score)) {
      warnings.push(issue("missing_home_score", "Parsed match artifact is missing a valid match.home_score."));
    }

    if (!isIntegerLike(artifact.match.away_score)) {
      warnings.push(issue("missing_away_score", "Parsed match artifact is missing a valid match.away_score."));
    }

    if (!isNonEmptyString(artifact.match.date)) {
      warnings.push(issue("missing_match_date", "Parsed match artifact is missing match.date."));
    }

    if (!isNonEmptyString(artifact.match.venue)) {
      warnings.push(issue("missing_match_venue", "Parsed match artifact is missing match.venue."));
    }
  }

  if (!isRecord(artifact.teams)) {
    errors.push(issue("missing_teams_payload", "Parsed match artifact is missing teams."));
  } else {
    validateParsedTeamSide(artifact.teams.home, "home", errors, warnings);
    validateParsedTeamSide(artifact.teams.away, "away", errors, warnings);
  }

  validateWarningList(artifact.warnings, "artifact.warnings", errors);

  return createValidationResult("parsed-match", filePath, errors, warnings, {
    match_id: artifact.match_id ?? null,
  });
}

export function validateTeamArtifact(artifact, { filePath = null } = {}) {
  const errors = [];
  const warnings = [];

  if (!isRecord(artifact)) {
    errors.push(issue("team_artifact_not_object", "Team artifact must be an object."));
    return createValidationResult("team-artifact", filePath, errors, warnings);
  }

  if (artifact.schema_version !== "match-summary-team-v1") {
    warnings.push(
      issue(
        "unexpected_schema_version",
        `Expected schema_version \"match-summary-team-v1\" but received ${formatValue(artifact.schema_version)}.`,
      ),
    );
  }

  if (!isNonEmptyString(artifact.match_id)) {
    warnings.push(issue("missing_match_id", "Team artifact is missing match_id."));
  }

  if (artifact.side !== "home" && artifact.side !== "away") {
    errors.push(issue("invalid_side", "Team artifact side must be \"home\" or \"away\"."));
  }

  if (!isRecord(artifact.source)) {
    errors.push(issue("missing_source", "Team artifact is missing source."));
  } else if (!isNonEmptyString(artifact.source.parsed_match_path)) {
    warnings.push(issue("missing_source_path", "Team artifact is missing source.parsed_match_path."));
  }

  if (!isRecord(artifact.match)) {
    errors.push(issue("missing_match_payload", "Team artifact is missing match."));
  }

  if (!isRecord(artifact.team)) {
    errors.push(issue("missing_team_payload", "Team artifact is missing team."));
  } else {
    if (!isNonEmptyString(artifact.team.name)) {
      errors.push(issue("missing_team_name", "Team artifact is missing team.name."));
    }

    if (!isNonEmptyString(artifact.team.slug)) {
      errors.push(issue("missing_team_slug", "Team artifact is missing team.slug."));
    }

    if (!isNonEmptyString(artifact.team.formation)) {
      warnings.push(issue("missing_team_formation", "Team artifact is missing team.formation."));
    }

    if (!Array.isArray(artifact.team.starters)) {
      errors.push(issue("invalid_starters", "Team artifact team.starters must be an array."));
    } else {
      if (artifact.team.starters.length !== 11) {
        warnings.push(
          issue(
            "unexpected_starter_count",
            `Team artifact expected 11 starters but found ${artifact.team.starters.length}.`,
          ),
        );
      }

      validatePlayerCollection(artifact.team.starters, "team.starters", errors, warnings, {
        requirePosition: false,
      });
    }

    if (!Array.isArray(artifact.team.substitutes)) {
      errors.push(issue("invalid_substitutes", "Team artifact team.substitutes must be an array."));
    } else {
      validatePlayerCollection(artifact.team.substitutes, "team.substitutes", errors, warnings, {
        requirePosition: false,
      });
    }

    if (isRecord(artifact.team.resolution)) {
      if (artifact.team.resolution.resolved !== true) {
        warnings.push(
          issue(
            "unresolved_team_folder",
            `Team artifact for ${formatValue(artifact.team.name)} does not resolve cleanly to a samples/teams folder.`,
          ),
        );
      }
    } else {
      warnings.push(issue("missing_team_resolution", "Team artifact is missing team.resolution."));
    }

    validateWarningList(artifact.team.warnings, "team.warnings", errors);
  }

  return createValidationResult("team-artifact", filePath, errors, warnings, {
    match_id: artifact.match_id ?? null,
    team_slug: artifact?.team?.slug ?? null,
  });
}

export function validateFormationExportArtifact(artifact, { filePath = null, teamArtifact = null, expectedOutputPath = null } = {}) {
  const errors = [];
  const warnings = [];

  if (!isRecord(artifact)) {
    errors.push(issue("formation_export_not_object", "Formation export artifact must be an object."));
    return createValidationResult("formation-export", filePath, errors, warnings);
  }

  if (!isRecord(artifact.country)) {
    errors.push(issue("missing_country_payload", "Formation export artifact is missing country."));
  } else if (!isNonEmptyString(artifact.country.slug) && !isNonEmptyString(artifact.country.name)) {
    errors.push(issue("missing_country_identity", "Formation export artifact needs country.slug or country.name."));
  }

  if (!isRecord(artifact.team)) {
    errors.push(issue("missing_team_payload", "Formation export artifact is missing team."));
  } else {
    if (!isNonEmptyString(artifact.team.name)) {
      errors.push(issue("missing_team_name", "Formation export artifact is missing team.name."));
    }

    if (!isNonEmptyString(artifact.team.formation)) {
      errors.push(issue("missing_team_formation", "Formation export artifact is missing team.formation."));
    }
  }

  if (!Array.isArray(artifact.players)) {
    errors.push(issue("invalid_players", "Formation export artifact players must be an array."));
  }

  if (errors.length === 0) {
    try {
      createFormationDocument(artifact);
    } catch (error) {
      errors.push(
        issue(
          "formation_document_invalid",
          error instanceof Error ? error.message : String(error),
        ),
      );
    }
  }

  if (expectedOutputPath && filePath) {
    const normalizedPath = normalizePath(filePath);
    const expectedPath = normalizePath(expectedOutputPath);

    if (normalizedPath !== expectedPath) {
      warnings.push(
        issue(
          "unexpected_destination_path",
          `Formation export path should be ${expectedPath} but received ${normalizedPath}.`,
        ),
      );
    }
  }

  if (teamArtifact?.team) {
    const expectedTeamName = normalizeComparableString(teamArtifact.team.name);
    const actualTeamName = normalizeComparableString(artifact?.team?.name);
    const expectedSlug = normalizeComparableString(teamArtifact.team.slug);
    const actualSlug = normalizeComparableString(artifact?.country?.slug);

    if (expectedTeamName && actualTeamName && expectedTeamName !== actualTeamName) {
      warnings.push(
        issue(
          "team_name_mismatch",
          `Formation export team.name (${formatValue(artifact.team.name)}) does not match team artifact name (${formatValue(teamArtifact.team.name)}).`,
        ),
      );
    }

    if (expectedSlug && actualSlug && expectedSlug !== actualSlug) {
      warnings.push(
        issue(
          "team_slug_mismatch",
          `Formation export country.slug (${formatValue(artifact.country.slug)}) does not match team artifact slug (${formatValue(teamArtifact.team.slug)}).`,
        ),
      );
    }
  }

  return createValidationResult("formation-export", filePath, errors, warnings, {
    team_slug: artifact?.country?.slug ?? teamArtifact?.team?.slug ?? null,
  });
}

export function validateShirtNumberUpdateArtifact(artifact, { filePath = null } = {}) {
  const errors = [];
  const warnings = [];
  const seenPlayerIds = new Map();

  if (!isRecord(artifact)) {
    errors.push(issue("shirt_number_artifact_not_object", "Shirt-number update artifact must be an object."));
    return createValidationResult("shirt-number-update", filePath, errors, warnings);
  }

  if (artifact.schema_version !== "team-shirt-number-updates-v1") {
    warnings.push(
      issue(
        "unexpected_schema_version",
        `Expected schema_version \"team-shirt-number-updates-v1\" but received ${formatValue(artifact.schema_version)}.`,
      ),
    );
  }

  if (!isRecord(artifact.team)) {
    errors.push(issue("missing_team_payload", "Shirt-number update artifact is missing team."));
  } else {
    if (!isNonEmptyString(artifact.team.slug)) {
      errors.push(issue("missing_team_slug", "Shirt-number update artifact is missing team.slug."));
    }

    if (!isNonEmptyString(artifact.team.name)) {
      warnings.push(issue("missing_team_name", "Shirt-number update artifact is missing team.name."));
    }
  }

  if (!isNonEmptyString(artifact.match_id)) {
    warnings.push(issue("missing_match_id", "Shirt-number update artifact is missing match_id."));
  }

  if (!isRecord(artifact.source)) {
    warnings.push(issue("missing_source", "Shirt-number update artifact is missing source."));
  } else if (!isNonEmptyString(artifact.source.team_artifact_path)) {
    warnings.push(issue("missing_source_path", "Shirt-number update artifact is missing source.team_artifact_path."));
  }

  if (!Array.isArray(artifact.updates)) {
    errors.push(issue("invalid_updates", "Shirt-number update artifact updates must be an array."));
  } else {
    for (const [index, update] of artifact.updates.entries()) {
      if (!isRecord(update)) {
        errors.push(issue("invalid_update_entry", `updates[${index}] must be an object.`));
        continue;
      }

      if (!isNonEmptyString(update.captured_name)) {
        warnings.push(issue("missing_captured_name", `updates[${index}] is missing captured_name.`));
      }

      if (!isIntegerLike(update.shirt_number)) {
        warnings.push(issue("invalid_shirt_number", `updates[${index}] is missing a valid shirt_number.`));
      }

      if (!isNonEmptyString(update.matched_player_id) && !isFiniteNumber(update.matched_player_id)) {
        warnings.push(issue("missing_matched_player_id", `updates[${index}] is missing matched_player_id.`));
        continue;
      }

      const playerId = String(update.matched_player_id);
      const shirtNumber = parseInteger(update.shirt_number);

      if (seenPlayerIds.has(playerId) && seenPlayerIds.get(playerId) !== shirtNumber) {
        warnings.push(
          issue(
            "conflicting_player_shirt_number",
            `matched_player_id ${playerId} appears with conflicting shirt numbers (${seenPlayerIds.get(playerId)} vs ${shirtNumber}).`,
          ),
        );
      } else {
        seenPlayerIds.set(playerId, shirtNumber);
      }
    }
  }

  if (!Array.isArray(artifact.unresolved)) {
    errors.push(issue("invalid_unresolved", "Shirt-number update artifact unresolved must be an array."));
  }

  validateWarningList(artifact.warnings, "warnings", errors);

  return createValidationResult("shirt-number-update", filePath, errors, warnings, {
    team_slug: artifact?.team?.slug ?? null,
    unresolved_count: Array.isArray(artifact?.unresolved) ? artifact.unresolved.length : null,
    update_count: Array.isArray(artifact?.updates) ? artifact.updates.length : null,
  });
}

export function validateIngestionTree({ inputDir }) {
  const resolvedInputDir = resolve(process.cwd(), inputDir);
  const formationOutputDir = resolve(resolvedInputDir, FORMATION_EXPORT_DIRECTORY);

  if (!existsSync(resolvedInputDir)) {
    throw new Error(`Input directory does not exist: ${resolvedInputDir}`);
  }

  const results = [];

  collectArtifactResults({
    directoryPath: resolve(resolvedInputDir, "parsed"),
    suffix: ".parsed.json",
    artifactType: "parsed-match",
    validator: (artifact, context) => validateParsedMatchArtifact(artifact, context),
    results,
  });

  const teamResults = collectArtifactResults({
    directoryPath: resolve(resolvedInputDir, "teams"),
    suffix: ".team.json",
    artifactType: "team-artifact",
    validator: (artifact, context) => validateTeamArtifact(artifact, context),
    results,
    includeArtifacts: true,
  });

  collectArtifactResults({
    directoryPath: resolve(resolvedInputDir, SHIRT_NUMBER_UPDATE_DIRECTORY),
    suffix: ".shirt-numbers.json",
    artifactType: "shirt-number-update",
    validator: (artifact, context) => validateShirtNumberUpdateArtifact(artifact, context),
    results,
  });

  for (const teamResult of teamResults) {
    const teamArtifact = teamResult.artifact;
    const formationPath = getFormationExportOutputPath({
      outputRoot: formationOutputDir,
      teamArtifact,
      artifactPath: teamResult.filePath,
    });

    if (!existsSync(formationPath)) {
      results.push(
        createValidationResult(
          "formation-export",
          formationPath,
          [],
          [
            issue(
              "missing_formation_export",
              `Expected formation export at ${formationPath} but no file exists there yet.`,
            ),
          ],
          {
            team_slug: teamArtifact?.team?.slug ?? null,
            match_id: teamArtifact?.match_id ?? null,
            source_team_artifact_path: teamResult.filePath,
          },
        ),
      );
      continue;
    }

    const formationPayload = tryReadJson(formationPath);

    if (formationPayload.error) {
      results.push(
        createValidationResult(
          "formation-export",
          formationPath,
          [issue("invalid_json", formationPayload.error.message)],
          [],
          {
            team_slug: teamArtifact?.team?.slug ?? null,
            match_id: teamArtifact?.match_id ?? null,
            source_team_artifact_path: teamResult.filePath,
          },
        ),
      );
      continue;
    }

    results.push(
      validateFormationExportArtifact(formationPayload.value, {
        filePath: formationPath,
        teamArtifact,
        expectedOutputPath: formationPath,
      }),
    );
  }

  return buildValidationSummary(resolvedInputDir, results);
}

export function renderValidationSummaryMarkdown(summary) {
  const lines = [
    "# Match Summary Ingest Validation Summary",
    "",
    `- Generated: ${summary.generated_at}`,
    `- Input directory: ${summary.input_dir}`,
    `- Status: ${summary.status.toUpperCase()}`,
    "",
    "## Totals",
    "",
    "| Metric | Value |",
    "| --- | ---: |",
    `| Files scanned | ${summary.totals.files_scanned} |`,
    `| Parsed match artifacts | ${summary.totals.parsed_matches} |`,
    `| Team artifacts | ${summary.totals.team_artifacts} |`,
    `| Formation exports | ${summary.totals.formation_exports} |`,
    `| Shirt-number updates | ${summary.totals.shirt_number_updates} |`,
    `| Errors | ${summary.totals.errors} |`,
    `| Warnings | ${summary.totals.warnings} |`,
    `| Files with errors | ${summary.totals.files_with_errors} |`,
    `| Files with warnings | ${summary.totals.files_with_warnings} |`,
    "",
  ];

  if (summary.key_errors.length > 0) {
    lines.push("## Key Errors", "");

    for (const entry of summary.key_errors) {
      lines.push(`- ${entry.path}: ${entry.message}`);
    }

    lines.push("");
  }

  if (summary.key_warnings.length > 0) {
    lines.push("## Key Warnings", "");

    for (const entry of summary.key_warnings) {
      lines.push(`- ${entry.path}: ${entry.message}`);
    }

    lines.push("");
  }

  lines.push("## Artifact Details", "");

  for (const result of summary.files) {
    lines.push(`### ${result.path}`);
    lines.push("");
    lines.push(`- Type: ${result.artifact_type}`);
    lines.push(`- Errors: ${result.errors.length}`);
    lines.push(`- Warnings: ${result.warnings.length}`);

    if (result.errors.length > 0) {
      lines.push("", "Errors:");

      for (const entry of result.errors) {
        lines.push(`- ${entry.code}: ${entry.message}`);
      }
    }

    if (result.warnings.length > 0) {
      lines.push("", "Warnings:");

      for (const entry of result.warnings) {
        lines.push(`- ${entry.code}: ${entry.message}`);
      }
    }

    lines.push("");
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

function collectArtifactResults({
  directoryPath,
  suffix,
  artifactType,
  validator,
  results,
  includeArtifacts = false,
}) {
  const collected = [];

  if (!existsSync(directoryPath)) {
    results.push(
      createValidationResult(
        artifactType,
        directoryPath,
        [],
        [issue("missing_directory", `Directory does not exist: ${directoryPath}`)],
      ),
    );
    return collected;
  }

  const filePaths = readdirSync(directoryPath, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(suffix))
    .map((entry) => resolve(directoryPath, entry.name))
    .sort((left, right) => left.localeCompare(right, "en"));

  if (filePaths.length === 0) {
    results.push(
      createValidationResult(
        artifactType,
        directoryPath,
        [],
        [issue("empty_directory", `No ${suffix} artifacts were found in ${directoryPath}.`)],
      ),
    );
    return collected;
  }

  for (const filePath of filePaths) {
    const payload = tryReadJson(filePath);

    if (payload.error) {
      results.push(createValidationResult(artifactType, filePath, [issue("invalid_json", payload.error.message)], []));
      continue;
    }

    const validation = validator(payload.value, { filePath });
    results.push(validation);

    if (includeArtifacts) {
      collected.push({ filePath, artifact: payload.value, validation });
    }
  }

  return collected;
}

function buildValidationSummary(inputDir, results) {
  const files = results.map((result) => ({
    path: result.filePath ? normalizePath(result.filePath) : "(derived check)",
    artifact_type: result.artifactType,
    errors: result.errors,
    warnings: result.warnings,
    metadata: result.metadata ?? {},
  }));

  const totalErrors = files.reduce((sum, result) => sum + result.errors.length, 0);
  const totalWarnings = files.reduce((sum, result) => sum + result.warnings.length, 0);
  const countsByType = countBy(files, (result) => result.artifact_type);
  const keyErrors = files.flatMap((result) => result.errors.map((entry) => ({ ...entry, path: result.path })));
  const keyWarnings = files.flatMap((result) => result.warnings.map((entry) => ({ ...entry, path: result.path })));

  return {
    schema_version: "match-summary-ingest-validation-summary-v1",
    generated_at: new Date().toISOString(),
    input_dir: normalizePath(inputDir),
    status: totalErrors > 0 ? "errors" : totalWarnings > 0 ? "warnings" : "ok",
    totals: {
      files_scanned: files.length,
      parsed_matches: countsByType.get("parsed-match") ?? 0,
      team_artifacts: countsByType.get("team-artifact") ?? 0,
      formation_exports: countsByType.get("formation-export") ?? 0,
      shirt_number_updates: countsByType.get("shirt-number-update") ?? 0,
      errors: totalErrors,
      warnings: totalWarnings,
      files_with_errors: files.filter((result) => result.errors.length > 0).length,
      files_with_warnings: files.filter((result) => result.warnings.length > 0).length,
    },
    key_errors: keyErrors.slice(0, 25),
    key_warnings: keyWarnings.slice(0, 25),
    files,
  };
}

function validateParsedTeamSide(team, side, errors, warnings) {
  if (!isRecord(team)) {
    errors.push(issue("missing_team_side", `Parsed match artifact is missing teams.${side}.`));
    return;
  }

  if (!isNonEmptyString(team.name)) {
    warnings.push(issue("missing_team_name", `Parsed match artifact is missing teams.${side}.name.`));
  }

  if (!isNonEmptyString(team.formation)) {
    warnings.push(issue("missing_team_formation", `Parsed match artifact is missing teams.${side}.formation.`));
  }

  if (!Array.isArray(team.starters)) {
    errors.push(issue("invalid_starters", `Parsed match artifact teams.${side}.starters must be an array.`));
  } else {
    if (team.starters.length !== 11) {
      warnings.push(
        issue(
          "unexpected_starter_count",
          `Parsed match artifact teams.${side}.starters expected 11 players but found ${team.starters.length}.`,
        ),
      );
    }

    validatePlayerCollection(team.starters, `teams.${side}.starters`, errors, warnings, { requirePosition: false });
  }

  if (!Array.isArray(team.substitutes)) {
    errors.push(issue("invalid_substitutes", `Parsed match artifact teams.${side}.substitutes must be an array.`));
  } else {
    validatePlayerCollection(team.substitutes, `teams.${side}.substitutes`, errors, warnings, { requirePosition: false });
  }

  validateWarningList(team.warnings, `teams.${side}.warnings`, errors);
}

function validatePlayerCollection(players, context, errors, warnings, { requirePosition }) {
  const seenNumbers = new Set();

  for (const [index, player] of players.entries()) {
    const label = `${context}[${index}]`;

    if (!isRecord(player)) {
      errors.push(issue("invalid_player_entry", `${label} must be an object.`));
      continue;
    }

    if (!isIntegerLike(player.shirt_number)) {
      errors.push(issue("invalid_player_shirt_number", `${label} is missing a valid shirt_number.`));
    } else {
      const shirtNumber = parseInteger(player.shirt_number);

      if (seenNumbers.has(shirtNumber)) {
        warnings.push(issue("duplicate_shirt_number", `${context} contains duplicate shirt_number ${shirtNumber}.`));
      }

      seenNumbers.add(shirtNumber);
    }

    if (!isNonEmptyString(player.name)) {
      errors.push(issue("missing_player_name", `${label} is missing name.`));
    }

    if (requirePosition && !isNonEmptyString(player.position)) {
      warnings.push(issue("missing_player_position", `${label} is missing position.`));
    }
  }
}

function validateWarningList(value, context, errors) {
  if (value != null && !Array.isArray(value)) {
    errors.push(issue("invalid_warnings_array", `${context} must be an array when present.`));
  }
}

function tryReadJson(filePath) {
  try {
    return { value: JSON.parse(readFileSync(filePath, "utf8")), error: null };
  } catch (error) {
    return {
      value: null,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

function createValidationResult(artifactType, filePath, errors, warnings, metadata = {}) {
  return {
    artifactType,
    filePath,
    errors,
    warnings,
    metadata,
  };
}

function countBy(items, getKey) {
  const counts = new Map();

  for (const item of items) {
    const key = getKey(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return counts;
}

function issue(code, message) {
  return { code, message };
}

function isRecord(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isIntegerLike(value) {
  return Number.isInteger(parseInteger(value));
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function parseInteger(value) {
  if (typeof value === "number") {
    return Number.isInteger(value) ? value : Number.NaN;
  }

  if (typeof value === "string" && value.trim()) {
    return Number.parseInt(value, 10);
  }

  return Number.NaN;
}

function formatValue(value) {
  return JSON.stringify(value ?? null);
}

function normalizeComparableString(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}
