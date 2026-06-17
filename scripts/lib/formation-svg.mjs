const LINE_Y_POSITIONS = new Map([
  [1, [50]],
  [2, [35, 65]],
  [3, [22, 50, 78]],
  [4, [18, 38, 62, 82]],
  [5, [14, 32, 50, 68, 86]],
]);

const FORMATION_LAYOUTS = new Map([
  [
    "4-1-2-3",
    buildFormationLayout([
      { role: "GK", slots: ["GK"], x: 8.5 },
      { role: "DF", slots: ["LB", "LCB", "RCB", "RB"], x: [24, 22, 22, 24] },
      { role: "MF", slots: ["DM"], x: 42 },
      { role: "MF", slots: ["LCM", "RCM"], x: 57 },
      {
        role: "FW",
        slots: [
          { slot: "LW", acceptedRoles: ["FW", "MF"] },
          "ST",
          { slot: "RW", acceptedRoles: ["FW", "MF"] },
        ],
        x: [76, 81, 76],
        y: [22, 50, 78],
      },
    ]),
  ],
  [
    "4-4-2",
    buildFormationLayout([
      { role: "GK", slots: ["GK"], x: 8.5 },
      { role: "DF", slots: ["LB", "LCB", "RCB", "RB"], x: [24, 22, 22, 24] },
      {
        role: "MF",
        slots: [
          { slot: "LM", acceptedRoles: ["MF", "FW"] },
          "LCM",
          "RCM",
          { slot: "RM", acceptedRoles: ["MF", "FW"] },
        ],
        x: [50, 47, 47, 50],
      },
      { role: "FW", slots: ["LST", "RST"], x: 78, y: [36, 64] },
    ]),
  ],
  [
    "4-3-3",
    buildFormationLayout([
      { role: "GK", slots: ["GK"], x: 8.5 },
      { role: "DF", slots: ["LB", "LCB", "RCB", "RB"], x: [24, 22, 22, 24] },
      { role: "MF", slots: ["LCM", "CM", "RCM"], x: [53, 49, 53], y: [28, 50, 72] },
      {
        role: "FW",
        slots: [
          { slot: "LW", acceptedRoles: ["FW", "MF"] },
          "ST",
          { slot: "RW", acceptedRoles: ["FW", "MF"] },
        ],
        x: [74, 82, 74],
      },
    ]),
  ],
  [
    "4-4-1-1",
    buildFormationLayout([
      { role: "GK", slots: ["GK"], x: 8.5 },
      { role: "DF", slots: ["LB", "LCB", "RCB", "RB"], x: [24, 22, 22, 24] },
      {
        role: "MF",
        slots: [
          { slot: "LM", acceptedRoles: ["MF", "FW"] },
          "LCM",
          "RCM",
          { slot: "RM", acceptedRoles: ["MF", "FW"] },
        ],
        x: [48, 46, 46, 48],
      },
      { role: "FW", slots: [{ slot: "SS", acceptedRoles: ["FW", "MF"] }], x: 67 },
      { role: "FW", slots: ["ST"], x: 82 },
    ]),
  ],
  [
    "4-1-4-1",
    buildFormationLayout([
      { role: "GK", slots: ["GK"], x: 8.5 },
      { role: "DF", slots: ["LB", "LCB", "RCB", "RB"], x: [24, 22, 22, 24] },
      { role: "MF", slots: ["DM"], x: 41 },
      {
        role: "MF",
        slots: [
          { slot: "LM", acceptedRoles: ["MF", "FW"] },
          "LCM",
          "RCM",
          { slot: "RM", acceptedRoles: ["MF", "FW"] },
        ],
        x: [58, 54, 54, 58],
      },
      { role: "FW", slots: ["ST"], x: 82 },
    ]),
  ],
  [
    "4-2-2-2",
    buildFormationLayout([
      { role: "GK", slots: ["GK"], x: 8.5 },
      { role: "DF", slots: ["LB", "LCB", "RCB", "RB"], x: [24, 22, 22, 24] },
      { role: "MF", slots: ["LDM", "RDM"], x: 42, y: [36, 64] },
      {
        role: "MF",
        slots: [
          { slot: "LAM", acceptedRoles: ["MF", "FW"] },
          { slot: "RAM", acceptedRoles: ["MF", "FW"] },
        ],
        x: 62,
        y: [36, 64],
      },
      { role: "FW", slots: ["LST", "RST"], x: 80, y: [36, 64] },
    ]),
  ],
  [
    "4-2-3-1",
    buildFormationLayout([
      { role: "GK", slots: ["GK"], x: 8.5 },
      { role: "DF", slots: ["LB", "LCB", "RCB", "RB"], x: [24, 22, 22, 24] },
      { role: "MF", slots: ["LDM", "RDM"], x: 42, y: [36, 64] },
      {
        role: "MF",
        slots: [
          { slot: "LW", acceptedRoles: ["FW", "MF"] },
          { slot: "CAM", acceptedRoles: ["MF", "FW"] },
          { slot: "RW", acceptedRoles: ["FW", "MF"] },
        ],
        x: [68, 73, 68],
      },
      { role: "FW", slots: ["ST"], x: 82 },
    ]),
  ],
  [
    "3-4-3",
    buildFormationLayout([
      { role: "GK", slots: ["GK"], x: 8.5 },
      { role: "DF", slots: ["LCB", "CB", "RCB"], x: [22, 18.5, 22] },
      {
        role: "MF",
        slots: [
          { slot: "LM", acceptedRoles: ["MF", "FW"] },
          "LCM",
          "RCM",
          { slot: "RM", acceptedRoles: ["MF", "FW"] },
        ],
        x: [52, 48, 48, 52],
      },
      {
        role: "FW",
        slots: [
          { slot: "LW", acceptedRoles: ["FW", "MF"] },
          "ST",
          { slot: "RW", acceptedRoles: ["FW", "MF"] },
        ],
        x: [74, 82, 74],
      },
    ]),
  ],
  [
    "3-5-2",
    buildFormationLayout([
      { role: "GK", slots: ["GK"], x: 8.5 },
      { role: "DF", slots: ["LCB", "CB", "RCB"], x: [22, 18.5, 22] },
      {
        role: "MF",
        slots: [
          { slot: "LM", acceptedRoles: ["MF", "FW"] },
          "LCM",
          "CM",
          "RCM",
          { slot: "RM", acceptedRoles: ["MF", "FW"] },
        ],
        x: [56, 50, 46, 50, 56],
      },
      { role: "FW", slots: ["LST", "RST"], x: 80, y: [36, 64] },
    ]),
  ],
  [
    "4-3-1-2",
    buildFormationLayout([
      { role: "GK", slots: ["GK"], x: 8.5 },
      { role: "DF", slots: ["LB", "LCB", "RCB", "RB"], x: [24, 22, 22, 24] },
      { role: "MF", slots: ["LCM", "CM", "RCM"], x: [53, 49, 53], y: [28, 50, 72] },
      { role: "MF", slots: [{ slot: "CAM", acceptedRoles: ["MF", "FW"] }], x: 68 },
      { role: "FW", slots: ["LST", "RST"], x: 80, y: [36, 64] },
    ]),
  ],
  [
    "3-2-4-1",
    buildFormationLayout([
      { role: "GK", slots: ["GK"], x: 8.5 },
      { role: "DF", slots: ["LCB", "CB", "RCB"], x: [22, 18.5, 22] },
      { role: "MF", slots: ["LDM", "RDM"], x: 40, y: [36, 64] },
      {
        role: "MF",
        slots: [
          { slot: "LW", acceptedRoles: ["FW", "MF"] },
          { slot: "LAM", acceptedRoles: ["MF", "FW"] },
          { slot: "RAM", acceptedRoles: ["MF", "FW"] },
          { slot: "RW", acceptedRoles: ["FW", "MF"] },
        ],
        x: [68, 72, 72, 68],
      },
      { role: "FW", slots: ["ST"], x: 82 },
    ]),
  ],
  [
    "5-3-2",
    buildFormationLayout([
      { role: "GK", slots: ["GK"], x: 8.5 },
      {
        slots: [
          { slot: "LWB", role: "DF", acceptedRoles: ["DF", "MF"], x: 28 },
          { slot: "LCB", role: "DF", x: 22 },
          { slot: "CB", role: "DF", x: 18.5 },
          { slot: "RCB", role: "DF", x: 22 },
          { slot: "RWB", role: "DF", acceptedRoles: ["DF", "MF"], x: 28 },
        ],
      },
      { role: "MF", slots: ["LCM", "CM", "RCM"], x: [58, 54, 58], y: [28, 50, 72] },
      { role: "FW", slots: ["LST", "RST"], x: 80, y: [36, 64] },
    ]),
  ],
  [
    "5-2-3",
    buildFormationLayout([
      { role: "GK", slots: ["GK"], x: 8.5 },
      {
        slots: [
          { slot: "LWB", role: "DF", acceptedRoles: ["DF", "MF"], x: 28 },
          { slot: "LCB", role: "DF", x: 22 },
          { slot: "CB", role: "DF", x: 18.5 },
          { slot: "RCB", role: "DF", x: 22 },
          { slot: "RWB", role: "DF", acceptedRoles: ["DF", "MF"], x: 28 },
        ],
      },
      { role: "MF", slots: ["LCM", "RCM"], x: 52, y: [36, 64] },
      {
        role: "FW",
        slots: [
          { slot: "LW", acceptedRoles: ["FW", "MF"] },
          "ST",
          { slot: "RW", acceptedRoles: ["FW", "MF"] },
        ],
        x: [74, 82, 74],
      },
    ]),
  ],
]);

export const SUPPORTED_FORMATIONS = Object.freeze(Array.from(FORMATION_LAYOUTS.keys()));

const DEFAULT_PITCH = {
  coordinateSystem: "percentage",
  origin: "top-left",
  width: 100,
  height: 100,
  orientation: "left-to-right",
};

const DEFAULT_THEME = {
  background: "#052e16",
  pitch: "#166534",
  lines: "#dcfce7",
  marker: "#0f766e",
  markerStroke: "#ecfeff",
  text: "#f8fafc",
  label: "#d1fae5",
};

export function createFormationDocument(input) {
  const teamName = String(input?.team?.name ?? "").trim();
  const formation = String(input?.team?.formation ?? "").trim();

  if (!teamName) throw new Error("Formation input requires team.name.");
  if (!formation) throw new Error("Formation input requires team.formation.");

  const layout = getFormationLayout(formation);
  const players = normalizePlayers(input?.players ?? []);

  if (players.length !== layout.length) {
    throw new Error(`Formation ${formation} expects ${layout.length} players, received ${players.length}.`);
  }

  const document = {
    schemaVersion: 1,
    team: {
      ...input.team,
      name: teamName,
      formation,
    },
    pitch: DEFAULT_PITCH,
    players: assignPlayersToLayout({
      players,
      layout,
      slotAssignments: normalizeSlotAssignments(input?.slotAssignments ?? input?.playerAssignments),
    }),
  };

  if (input?.match) document.match = input.match;
  if (input?.source) document.source = input.source;

  return document;
}

export function renderFormationSvg(document, options = {}) {
  const width = options.width ?? 840;
  const height = options.height ?? 540;
  const paddingX = options.paddingX ?? 56;
  const paddingY = options.paddingY ?? 44;
  const playerRadius = options.playerRadius ?? 18;
  const numberFontSize = options.numberFontSize ?? 14;
  const labelFontSize = options.labelFontSize ?? 12;
  const labelOffset = options.labelOffset ?? 28;
  const theme = { ...DEFAULT_THEME, ...(options.theme ?? {}) };
  const pitchWidth = width - paddingX * 2;
  const pitchHeight = height - paddingY * 2;
  const pitchLeft = paddingX;
  const pitchTop = paddingY;
  const pitchRight = pitchLeft + pitchWidth;
  const pitchBottom = pitchTop + pitchHeight;
  const midfieldX = pitchLeft + pitchWidth / 2;
  const centerY = pitchTop + pitchHeight / 2;
  const centerCircleRadius = pitchHeight * 0.13;
  const penaltyHeight = pitchHeight * 0.42;
  const goalAreaHeight = pitchHeight * 0.2;
  const penaltyWidth = pitchWidth * 0.145;
  const goalAreaWidth = pitchWidth * 0.055;
  const spotOffset = pitchWidth * 0.086;
  const ariaLabel = `${document.team.name} formation ${document.team.formation}`;

  const playerNodes = document.players
    .map((player) => {
      const x = paddingX + (player.x / 100) * pitchWidth;
      const y = paddingY + (player.y / 100) * pitchHeight;

      return `<g><circle cx="${formatNumber(x)}" cy="${formatNumber(y)}" r="${playerRadius}" fill="${theme.marker}" stroke="${theme.markerStroke}" stroke-width="2.5"/><text x="${formatNumber(x)}" y="${formatNumber(y + 5)}" text-anchor="middle" font-family="Arial,sans-serif" font-size="${numberFontSize}" font-weight="700" fill="${theme.text}">${escapeXml(String(player.number))}</text><text x="${formatNumber(x)}" y="${formatNumber(y + labelOffset)}" text-anchor="middle" font-family="Arial,sans-serif" font-size="${labelFontSize}" font-weight="600" fill="${theme.label}">${escapeXml(player.label)}</text></g>`;
    })
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(ariaLabel)}"><rect width="${width}" height="${height}" fill="${theme.background}"/><rect x="${pitchLeft}" y="${pitchTop}" width="${pitchWidth}" height="${pitchHeight}" rx="20" fill="${theme.pitch}" stroke="${theme.lines}" stroke-width="3"/><line x1="${formatNumber(midfieldX)}" y1="${pitchTop}" x2="${formatNumber(midfieldX)}" y2="${formatNumber(pitchBottom)}" stroke="${theme.lines}" stroke-width="3"/><circle cx="${formatNumber(midfieldX)}" cy="${formatNumber(centerY)}" r="${formatNumber(centerCircleRadius)}" fill="none" stroke="${theme.lines}" stroke-width="3"/><circle cx="${formatNumber(midfieldX)}" cy="${formatNumber(centerY)}" r="4" fill="${theme.lines}"/><circle cx="${formatNumber(pitchLeft + spotOffset)}" cy="${formatNumber(centerY)}" r="4" fill="${theme.lines}"/><circle cx="${formatNumber(pitchRight - spotOffset)}" cy="${formatNumber(centerY)}" r="4" fill="${theme.lines}"/><rect x="${pitchLeft}" y="${formatNumber(centerY - penaltyHeight / 2)}" width="${formatNumber(penaltyWidth)}" height="${formatNumber(penaltyHeight)}" fill="none" stroke="${theme.lines}" stroke-width="3"/><rect x="${formatNumber(pitchRight - penaltyWidth)}" y="${formatNumber(centerY - penaltyHeight / 2)}" width="${formatNumber(penaltyWidth)}" height="${formatNumber(penaltyHeight)}" fill="none" stroke="${theme.lines}" stroke-width="3"/><rect x="${pitchLeft}" y="${formatNumber(centerY - goalAreaHeight / 2)}" width="${formatNumber(goalAreaWidth)}" height="${formatNumber(goalAreaHeight)}" fill="none" stroke="${theme.lines}" stroke-width="3"/><rect x="${formatNumber(pitchRight - goalAreaWidth)}" y="${formatNumber(centerY - goalAreaHeight / 2)}" width="${formatNumber(goalAreaWidth)}" height="${formatNumber(goalAreaHeight)}" fill="none" stroke="${theme.lines}" stroke-width="3"/>${playerNodes}</svg>`;
}

export function createCountryFormationUpdate(input, options = {}) {
  const country = normalizeCountry(input?.country ?? {}, input?.team ?? {});
  const document = createFormationDocument({
    ...input,
    team: {
      ...(input?.team ?? {}),
      name: String(input?.team?.name ?? country.name ?? country.slug ?? "").trim(),
      formation: String(input?.team?.formation ?? input?.formation ?? "").trim(),
    },
  });
  const svg = renderFormationSvg(document, options.svgOptions);
  const sql = buildCountryFormationUpdateSql({
    country,
    formationSvg: svg,
    tableName: options.tableName,
    columnName: options.columnName,
  });

  return {
    schemaVersion: 1,
    country,
    document,
    formationSvg: svg,
    sql,
  };
}

export function buildCountryFormationUpdateSql({
  country,
  formationSvg,
  tableName = "public.country",
  columnName = "formation",
}) {
  const normalizedCountry = normalizeCountry(country);
  const whereClause = normalizedCountry.slug
    ? `slug = ${toSqlLiteral(normalizedCountry.slug)}`
    : `name = ${toSqlLiteral(normalizedCountry.name)}`;

  return `update ${tableName} set ${columnName} = ${toSqlLiteral(formationSvg)} where ${whereClause};`;
}

export function getFormationLayout(formation) {
  const layout = FORMATION_LAYOUTS.get(formation);
  if (!layout) {
    throw new Error(
      `Unsupported formation layout: ${formation}. Supported layouts: ${SUPPORTED_FORMATIONS.join(", ")}`,
    );
  }
  return layout.map((position) => ({ ...position, acceptedRoles: [...position.acceptedRoles] }));
}

function normalizePlayers(players) {
  if (!Array.isArray(players) || players.length === 0) {
    throw new Error("Formation input requires a non-empty players array.");
  }

  const seenNumbers = new Set();

  return players.map((player, index) => {
    const number = Number.parseInt(player?.number, 10);
    const name = String(player?.name ?? "").trim();
    const role = normalizeRole(player?.role);
    const slot = player?.slot ? String(player.slot).trim().toUpperCase() : null;
    const label = String(player?.label ?? name).trim();

    if (!Number.isInteger(number)) throw new Error(`Player at index ${index} is missing a valid number.`);
    if (seenNumbers.has(number)) throw new Error(`Duplicate player number detected: ${number}.`);
    if (!name) throw new Error(`Player ${number} is missing a name.`);

    seenNumbers.add(number);

    return { number, name, role, slot, label: label || name };
  });
}

function normalizeCountry(country, team = {}) {
  const slug = normalizeOptionalString(country?.slug);
  const name = normalizeOptionalString(country?.name) ?? normalizeOptionalString(team?.name);

  if (!slug && !name) {
    throw new Error("Country update input requires country.slug or country.name.");
  }

  return {
    ...(slug ? { slug } : {}),
    ...(name ? { name } : {}),
  };
}

function normalizeRole(role) {
  const normalizedRole = String(role ?? "").trim().toUpperCase();
  const aliases = new Map([
    ["GK", "GK"],
    ["DF", "DF"],
    ["DEF", "DF"],
    ["MF", "MF"],
    ["MID", "MF"],
    ["FW", "FW"],
    ["FWD", "FW"],
    ["ATT", "FW"],
  ]);
  const resolvedRole = aliases.get(normalizedRole);
  if (!resolvedRole) throw new Error(`Unsupported player role: ${role}`);
  return resolvedRole;
}

function normalizeSlotAssignments(slotAssignments) {
  if (!slotAssignments) return new Map();

  if (slotAssignments instanceof Map) {
    return new Map(
      Array.from(slotAssignments.entries(), ([playerNumber, slot]) => [
        Number.parseInt(playerNumber, 10),
        String(slot).trim().toUpperCase(),
      ]),
    );
  }

  if (typeof slotAssignments === "object") {
    return new Map(
      Object.entries(slotAssignments).map(([playerNumber, slot]) => [
        Number.parseInt(playerNumber, 10),
        String(slot).trim().toUpperCase(),
      ]),
    );
  }

  throw new Error("slotAssignments must be a Map or plain object.");
}

function assignPlayersToLayout({ players, layout, slotAssignments }) {
  const playersByNumber = new Map(players.map((player) => [player.number, player]));
  const layoutSlots = new Set(layout.map((position) => position.slot));
  const explicitBySlot = new Map();

  for (const player of players) {
    const slot = player.slot ?? slotAssignments.get(player.number) ?? null;
    if (!slot) continue;
    if (!layoutSlots.has(slot)) throw new Error(`Unknown slot ${slot} for player ${player.number}.`);
    if (explicitBySlot.has(slot)) throw new Error(`Slot ${slot} was assigned more than once.`);
    explicitBySlot.set(slot, player);
  }

  for (const [playerNumber, slot] of slotAssignments) {
    if (!playersByNumber.has(playerNumber)) {
      throw new Error(`Slot assignment references missing player number ${playerNumber}.`);
    }
    if (!layoutSlots.has(slot)) throw new Error(`Unknown slot ${slot} in slotAssignments.`);

    const existingPlayer = explicitBySlot.get(slot);
    if (existingPlayer && existingPlayer.number !== playerNumber) {
      throw new Error(`Slot ${slot} was assigned more than once.`);
    }

    explicitBySlot.set(slot, playersByNumber.get(playerNumber));
  }

  const usedNumbers = new Set();
  const playersByRole = groupPlayersByRole(players, slotAssignments);

  const assignedPlayers = layout.map((position) => {
    const explicitPlayer = explicitBySlot.get(position.slot);
    const player = explicitPlayer ?? pickAutoAssignedPlayer(playersByRole, position, usedNumbers);

    if (!player) throw new Error(`Could not assign a player to slot ${position.slot}.`);
    if (!position.acceptedRoles.includes(player.role)) {
      throw new Error(
        `Player ${player.number} role ${player.role} cannot be assigned to slot ${position.slot}; expected ${position.acceptedRoles.join(" or ")}.`,
      );
    }
    if (usedNumbers.has(player.number)) throw new Error(`Player ${player.number} was assigned more than once.`);

    usedNumbers.add(player.number);

    return {
      number: player.number,
      name: player.name,
      role: player.role,
      slot: position.slot,
      x: position.x,
      y: position.y,
      label: player.label,
    };
  });

  if (usedNumbers.size !== players.length) {
    const unassignedPlayers = players.filter((player) => !usedNumbers.has(player.number));
    throw new Error(`Some players were not assigned to the layout: ${unassignedPlayers.map((player) => player.name).join(", ")}`);
  }

  return assignedPlayers;
}

function buildFormationLayout(lines) {
  return lines.flatMap((line) => createLine(line));
}

function createLine({ slots, role = null, x = null, y = null, acceptedRoles = null }) {
  if (!Array.isArray(slots) || slots.length === 0) {
    throw new Error("Each formation line requires at least one slot.");
  }

  const defaultYPositions = y ?? getLineYPositions(slots.length);

  return slots.map((slotDefinition, index) => {
    const normalizedSlot = typeof slotDefinition === "string" ? { slot: slotDefinition } : slotDefinition;
    const slot = String(normalizedSlot?.slot ?? "").trim().toUpperCase();
    const resolvedRole = normalizeRole(normalizedSlot?.role ?? role);
    const resolvedAcceptedRoles = normalizeAcceptedRoles(
      normalizedSlot?.acceptedRoles ?? acceptedRoles,
      resolvedRole,
    );
    const resolvedX = normalizedSlot?.x ?? getIndexedValue(x, index);
    const resolvedY = normalizedSlot?.y ?? getIndexedValue(defaultYPositions, index);

    if (!slot) throw new Error("Formation slot definitions require a slot name.");
    if (resolvedX == null || resolvedY == null) {
      throw new Error(`Formation slot ${slot} is missing x/y coordinates.`);
    }

    return {
      slot,
      role: resolvedRole,
      acceptedRoles: resolvedAcceptedRoles,
      x: resolvedX,
      y: resolvedY,
    };
  });
}

function getLineYPositions(playerCount) {
  const yPositions = LINE_Y_POSITIONS.get(playerCount);
  if (!yPositions) throw new Error(`No default y positions configured for ${playerCount} players.`);
  return yPositions;
}

function getIndexedValue(value, index) {
  if (Array.isArray(value)) return value[index];
  return value;
}

function normalizeAcceptedRoles(acceptedRoles, primaryRole) {
  const roles = Array.isArray(acceptedRoles)
    ? acceptedRoles.map((role) => normalizeRole(role))
    : [primaryRole];

  if (!roles.includes(primaryRole)) roles.unshift(primaryRole);

  return Array.from(new Set(roles));
}

function groupPlayersByRole(players, slotAssignments) {
  const playersByRole = new Map([
    ["GK", []],
    ["DF", []],
    ["MF", []],
    ["FW", []],
  ]);

  for (const player of players) {
    if (player.slot || slotAssignments.has(player.number)) continue;
    playersByRole.get(player.role).push(player);
  }

  return playersByRole;
}

function pickAutoAssignedPlayer(playersByRole, position, usedNumbers) {
  for (const role of position.acceptedRoles) {
    const player = shiftUnusedPlayer(playersByRole.get(role) ?? [], usedNumbers);
    if (player) return player;
  }

  return null;
}

function shiftUnusedPlayer(candidates, usedNumbers) {
  while (candidates.length > 0) {
    const player = candidates.shift();
    if (player && !usedNumbers.has(player.number)) return player;
  }

  return null;
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function formatNumber(value) {
  return Number(value).toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
}

function toSqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function normalizeOptionalString(value) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}
