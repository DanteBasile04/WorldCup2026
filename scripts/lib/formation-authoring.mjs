const HEADER_PATTERN = /^(\S+)\s+([\d-]+(?:-\d+)*)$/;

const ROLE_ALIASES = new Map([
  ["GK", "GK"],
  ["DF", "DF"],
  ["DEF", "DF"],
  ["MF", "MF"],
  ["MID", "MF"],
  ["FW", "FW"],
  ["FWD", "FW"],
  ["ATT", "FW"],
]);

export function parseFormationAuthoringText(text) {
  const lines = String(text)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    throw new Error("Formation text requires at least a header line and one player line.");
  }

  const { slug, formation } = parseHeaderLine(lines[0]);
  const players = lines.slice(1).map((line, index) => parsePlayerLine(line, index + 2));

  if (players.length === 0) {
    throw new Error("No players parsed from formation text.");
  }

  return {
    country: { slug },
    team: { formation },
    players,
  };
}

export function parseFormationPlayersArgument(playersText) {
  const entries = String(playersText)
    .split(";")
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (entries.length === 0) {
    throw new Error("--players requires at least one player entry.");
  }

  return entries.map((entry, index) => parsePlayersArgumentEntry(entry, index + 1));
}

function parseHeaderLine(headerLine) {
  const headerMatch = headerLine.match(HEADER_PATTERN);

  if (!headerMatch) {
    throw new Error(
      `Header line must be "<country-slug> <formation>" (e.g. "argentina 4-3-3"). Got: "${headerLine}"`,
    );
  }

  return {
    slug: headerMatch[1],
    formation: headerMatch[2],
  };
}

function parsePlayerLine(line, lineNumber) {
  if (line.includes("|")) {
    return parseDelimitedPlayerLine(line, lineNumber);
  }

  const legacyMatch = line.match(/^(\d+)\s+(.+?)\s+(GK|DF|MF|FW|DEF|MID|FWD|ATT)$/i);

  if (!legacyMatch) {
    throw new Error(
      `Player line ${lineNumber} must be either "<number> <name> <role>" or "<number> | <name> | <role> | <label> | <slot>". Got: "${line}"`,
    );
  }

  return buildPlayer({
    numberText: legacyMatch[1],
    name: legacyMatch[2],
    roleText: legacyMatch[3],
    contextLabel: `Player line ${lineNumber}`,
  });
}

function parseDelimitedPlayerLine(line, lineNumber) {
  const columns = line.split("|").map((column) => column.trim());

  if (columns.length < 3 || columns.length > 5) {
    throw new Error(
      `Player line ${lineNumber} must use 3 to 5 pipe-delimited columns: "<number> | <name> | <role> | <label> | <slot>". Got: "${line}"`,
    );
  }

  const [numberText, name, roleText, label = "", slot = ""] = columns;

  return buildPlayer({
    numberText,
    name,
    roleText,
    label,
    slot,
    contextLabel: `Player line ${lineNumber}`,
  });
}

function parsePlayersArgumentEntry(entry, entryNumber) {
  const columns = entry.split(",").map((column) => column.trim());

  if (columns.length < 3 || columns.length > 5) {
    throw new Error(
      `Player entry ${entryNumber} must be "number,name,role[,label[,slot]]". Got: "${entry}"`,
    );
  }

  const [numberText, name, roleText, label = "", slot = ""] = columns;

  return buildPlayer({
    numberText,
    name,
    roleText,
    label,
    slot,
    contextLabel: `Player entry ${entryNumber}`,
  });
}

function buildPlayer({ numberText, name, roleText, label = "", slot = "", contextLabel }) {
  const number = Number.parseInt(numberText, 10);
  const normalizedName = String(name ?? "").trim();
  const normalizedRole = normalizeRole(roleText);
  const normalizedLabel = String(label ?? "").trim();
  const normalizedSlot = normalizeOptionalSlot(slot);

  if (!Number.isInteger(number)) {
    throw new Error(`${contextLabel} is missing a valid player number: "${numberText}"`);
  }

  if (!normalizedName) {
    throw new Error(`${contextLabel} is missing a player name.`);
  }

  return {
    number,
    name: normalizedName,
    role: normalizedRole,
    label: normalizedLabel || normalizedName,
    ...(normalizedSlot ? { slot: normalizedSlot } : {}),
  };
}

function normalizeRole(roleText) {
  const normalizedRole = String(roleText ?? "").trim().toUpperCase();
  const resolvedRole = ROLE_ALIASES.get(normalizedRole);

  if (!resolvedRole) {
    throw new Error(`Unsupported player role: ${roleText}`);
  }

  return resolvedRole;
}

function normalizeOptionalSlot(slotText) {
  const normalizedSlot = String(slotText ?? "").trim().toUpperCase();
  return normalizedSlot || null;
}
