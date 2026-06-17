const MEXICO_4_1_2_3_ASSIGNMENTS = new Map([
  [1, "GK"],
  [23, "LB"],
  [5, "LCB"],
  [3, "RCB"],
  [15, "RB"],
  [6, "DM"],
  [8, "LCM"],
  [26, "RCM"],
  [25, "LW"],
  [9, "ST"],
  [16, "RW"],
]);

export const MEXICO_MATCH_SUMMARY_EXAMPLE = {
  source: {
    kind: "fifa_match_summary",
    section: "formation",
    page: 2,
    parser: "fixture-v1",
  },
  match: {
    homeTeam: "Mexico",
    awayTeam: "South Africa",
    date: "2026-06-11",
    venue: "Mexico City Stadium",
  },
  team: {
    name: "Mexico",
    side: "home",
    formation: "4-1-2-3",
  },
  lineupText: `Starting Mexico:
1 GK Raul RANGEL
3 DF Cesar MONTES
5 DF Johan VASQUEZ
6 MF Erik LIRA
8 MF Alvaro FIDALGO
9 FW Raul JIMENEZ
15 DF Israel REYES
16 FW Julian QUINONES
23 DF Jesus GALLARDO
25 FW Roberto ALVARADO
26 MF Brian GUTIERREZ
Formation: 4-1-2-3`,
  playerAssignments: MEXICO_4_1_2_3_ASSIGNMENTS,
};

export function buildFormationInputFromText(input) {
  const parsed = parseFormationText(input.lineupText);

  return {
    source: input.source,
    match: input.match,
    team: {
      ...input.team,
      formation: input.team?.formation ?? parsed.formation,
    },
    players: parsed.players,
    slotAssignments: input.playerAssignments
      ? Object.fromEntries(input.playerAssignments.entries())
      : undefined,
  };
}

export function parseFormationText(lineupText) {
  const lines = String(lineupText ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const players = [];
  let formation = null;

  for (const line of lines) {
    if (/^starting\s+/i.test(line)) continue;

    const formationMatch = line.match(/^formation:\s*(.+)$/i);

    if (formationMatch) {
      formation = formationMatch[1].trim();
      continue;
    }

    const playerMatch = line.match(/^(\d+)\s+(GK|DF|MF|FW)\s+(.+)$/i);

    if (!playerMatch) continue;

    players.push({
      number: Number.parseInt(playerMatch[1], 10),
      role: playerMatch[2].toUpperCase(),
      name: playerMatch[3].trim(),
    });
  }

  if (!formation) throw new Error("Formation line was not found in the match summary text.");
  if (players.length === 0) throw new Error("No players were parsed from the match summary text.");

  return { formation, players };
}
