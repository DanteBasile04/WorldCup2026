// ---------------------------------------------------------------------------
// Tournament view models — convert raw query rows into render-safe shapes
// with winner/loser emphasis, qualification markers, and stable fallbacks.
// ---------------------------------------------------------------------------

import {
  FALLBACK,
  formatScore,
  parseTeamColors,
  textToThemeToken,
  type TeamPalette,
  type TeamThemeToken,
} from "./presentation";
import type {
  Country,
  Group,
  Match,
} from "@/lib/supabase/database.types";
import type { MatchWithTeams, StandingWithCountry, PlayerWithCountry } from "@/lib/supabase/queries";

// -- Standing row view model ------------------------------------------------

export type StandingRowVm = {
  rank: number;
  teamName: string;
  teamSlug: string | null;
  flagUrl: string | null;
  matchesPlayed: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  zone: "qualified" | "playoff" | "none";
  palette: TeamPalette;
};

// -- Bracket match view model -----------------------------------------------

export type MatchCardVm = {
  id: number;
  round: string;
  roundLabel: string;
  homeName: string;
  homeSlug: string | null;
  awayName: string;
  awaySlug: string | null;
  homeScore: string;
  awayScore: string;
  venue: string;
  status: string;
  date: string | null;
};

export type BracketMatchVm = MatchCardVm & {
  winnerSide: "home" | "away" | null;
};

// -- Group standings view model ---------------------------------------------

export type GroupStandingsVm = {
  groupSlug: string;
  groupName: string;
  rows: StandingRowVm[];
};

// -- Third-place ranking view model -----------------------------------------

/** Single row in the best-third-place ranking */
export type ThirdPlaceRowVm = {
  rank: number;
  teamName: string;
  teamSlug: string | null;
  flagUrl: string | null;
  groupName: string;
  matchesPlayed: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  advancing: boolean;
};

/** Result of building the third-place ranking, including data completeness */
export type ThirdPlaceRankingResult = {
  rows: ThirdPlaceRowVm[];
  /** True only when every group has enough standings data to
   *  determine all third-place teams, making advancement status meaningful. */
  dataComplete: boolean;
};

// -- Bracket connection view model ------------------------------------------

/** Describes an explicit advancement link between matches */
export type BracketConnectionVm = {
  fromMatchId: number;
  toMatchId: number;
};

// -- Bracket grid view models ------------------------------------------------

/** Canonical round ordering for the winner-progression bracket.
 *  Third place is EXCLUDED — it renders as a separate surface below
 *  the main bracket so there is no visual implication that it advances
 *  toward the final. */
export const BRACKET_ROUND_ORDER: string[] = [
  "round_of_32",
  "round_of_16",
  "quarter_final",
  "semi_final",
  "final",
];

/** Round slug for the Third Place match — rendered separately from the
 *  winner-progression bracket to avoid implying advancement to the final. */
export const THIRD_PLACE_ROUND = "third_place";

/** Display labels for bracket rounds (including third_place, used by the
 *  separate Third Place surface below the main bracket). */
export const BRACKET_ROUND_LABELS: Record<string, string> = {
  round_of_32: "Round of 32",
  round_of_16: "Round of 16",
  quarter_final: "Quarter-finals",
  semi_final: "Semi-finals",
  third_place: "Third place",
  final: "Final",
};

/** A single round column in the bracket grid */
export type BracketGridRound = {
  round: string;
  label: string;
  matches: BracketMatchVm[];
  /** True when the round has no match data — triggers placeholder rendering */
  isEmpty: boolean;
};

/** Result of connector display resolution for the bracket grid */
export type BracketConnectorState = {
  /** Connections whose both endpoints exist in the current match set */
  safe: BracketConnectionVm[];
  /** True when some connections were dropped due to missing match references */
  degraded: boolean;
};

/**
 * Build the bracket grid structure from match data.
 * Always includes all rounds in canonical order, marking empty
 * rounds with isEmpty=true for stable placeholder rendering.
 *
 * Test-ready pure function: deterministic, no side effects.
 */
export function buildBracketGridRounds(
  matches: BracketMatchVm[],
  roundOrder: string[],
  roundLabels: Record<string, string>,
): BracketGridRound[] {
  const byRound = new Map<string, BracketMatchVm[]>();
  for (const m of matches) {
    const list = byRound.get(m.round) ?? [];
    list.push(m);
    byRound.set(m.round, list);
  }

  return roundOrder.map((round) => {
    const roundMatches = byRound.get(round) ?? [];
    return {
      round,
      label: roundLabels[round] ?? round.replace(/_/g, " "),
      matches: roundMatches,
      isEmpty: roundMatches.length === 0,
    };
  });
}

/**
 * Determine which bracket connections are safe to render.
 * Filters out connections that reference match IDs not present
 * in the current match set. Returns safe connections and a
 * degraded flag when some connections were dropped.
 *
 * Test-ready pure function: deterministic, no side effects.
 * — Empty connections → no connectors, degraded=false
 * — All endpoints valid → all connectors shown, degraded=false
 * — Some endpoints missing → filtered set, degraded=true
 */
export function resolveConnectorDisplay(
  connections: BracketConnectionVm[],
  matchIds: Set<number>,
): BracketConnectorState {
  if (connections.length === 0) {
    return { safe: [], degraded: false };
  }

  const safe = connections.filter(
    (c) => matchIds.has(c.fromMatchId) && matchIds.has(c.toMatchId),
  );

  return {
    safe,
    degraded: safe.length < connections.length,
  };
}

// -- Landing view model -----------------------------------------------------

export type LandingVm = {
  groups: GroupStandingsVm[];
  knockout: BracketMatchVm[];
  /** Best third-place teams ranked across groups, with advancement status */
  thirdPlaceRanking: ThirdPlaceRowVm[];
  /** True only when every group has enough standings data to make
   *  advancement status meaningful. When false, rows may still appear
   *  but no team should be shown as advancing. */
  thirdPlaceDataComplete: boolean;
  /** Explicit bracket connection metadata derived from next_match_id */
  bracketConnections: BracketConnectionVm[];
  errors: string[];
};

// -- Team detail view model -------------------------------------------------

/** Single player view model for roster display */
export type TeamPlayerVm = {
  name: string;
  position: string;
  age: number | null;
  club: string | null;
};

export type TeamRosterGroupVm = {
  label: "Goalkeepers" | "Defenders" | "Midfielders" | "Forwards" | "Utility";
  players: TeamPlayerVm[];
};

/** Formation display state */
/** Formation display state */
export type FormationState =
  | { value: string; status: "published" }
  | { value: null; status: "unpublished" };

/** Team hero view model — crest, flag, trophies, federation */
export type TeamHeroVm = {
  name: string;
  slug: string;
  flagUrl: string | null;
  emblemUrl: string | null;
  federation: string | null;
  trophies: string | null;
  palette: TeamPalette;
};

/** Consolidated team identity info — title, federation, and trophies.
 *  Confederation is intentionally excluded: it duplicates what federation
 *  already conveys and the spec explicitly removes it from the Info card. */
export type TeamInfoVm = {
  title: string;
  federation: string | null;
  trophies: string | null;
};

/** Individual roster row view model — scan-friendly listing format.
 *  number and photoUrl are forward-compatible (currently null until
 *  jersey_number/player_photo columns are added to the DB). */
export type TeamRosterRowVm = {
  name: string;
  position: string;
  age: number | null;
  club: string | null;
  number?: string | null;
  photoUrl?: string | null;
};

export type TeamDetailVm = {
  hero: TeamHeroVm;
  info: TeamInfoVm;
  roster: {
    groups: TeamRosterGroupVm[];
    rows: TeamRosterRowVm[];
    isEmpty: boolean;
  };
  formation: FormationState;
  standings: StandingRowVm[];
  matches: MatchCardVm[];
  palette: TeamPalette;
  themeToken: TeamThemeToken;
};

// -- Helpers ----------------------------------------------------------------

/** Format round enum to display label */
function roundLabel(round: Match["round"]): string {
  if (!round) return FALLBACK.round;
  return BRACKET_ROUND_LABELS[round] ?? round.replace(/_/g, " ");
}

/** Determine qualification zone from rank within group */
function qualificationZone(rank: number): StandingRowVm["zone"] {
  if (rank <= 2) return "qualified";
  if (rank <= 4) return "playoff";
  return "none";
}

/** Build a StandingRowVm from a standing + optional country */
function buildStandingRow(
  standing: StandingWithCountry,
  rank: number,
): StandingRowVm {
  const country = standing.country;
  const gf = standing.goals_for ?? 0;
  const ga = standing.goals_against ?? 0;

  return {
    rank,
    teamName: country?.name ?? FALLBACK.teamName,
    teamSlug: country?.slug ?? null,
    flagUrl: country?.flag_url ?? null,
    matchesPlayed: standing.matches_played ?? 0,
    wins: standing.wins ?? 0,
    draws: standing.draws ?? 0,
    losses: standing.losses ?? 0,
    goalsFor: gf,
    goalsAgainst: ga,
    goalDifference: gf - ga,
    points: standing.points ?? 0,
    zone: qualificationZone(rank),
    palette: parseTeamColors(country?.colors ?? null, "badge"),
  };
}

/** Build a MatchCardVm from a hydrated match */
function buildMatchCard(match: MatchWithTeams): MatchCardVm {
  const home = match.localCountry;
  const away = match.awayCountry;

  return {
    id: match.id,
    round: match.round ?? "",
    roundLabel: roundLabel(match.round),
    homeName: home?.name ?? FALLBACK.teamName,
    homeSlug: home?.slug ?? null,
    awayName: away?.name ?? FALLBACK.teamName,
    awaySlug: away?.slug ?? null,
    homeScore: formatScore(
      match.local_score ?? null,
      match.away_score ?? null,
    ).split("\u2013")[0] ?? FALLBACK.score,
    awayScore: formatScore(
      match.local_score ?? null,
      match.away_score ?? null,
    ).split("\u2013")[1] ?? FALLBACK.score,
    venue: match.stadium ?? FALLBACK.venue,
    status: match.status ?? FALLBACK.status,
    date: match.date,
  };
}

/** Determine winner side from completed match scores */
function winnerSide(match: MatchWithTeams): "home" | "away" | null {
  if (match.status !== "finished") return null;
  if (match.local_score === null || match.away_score === null) return null;
  if (match.local_score > match.away_score) return "home";
  if (match.away_score > match.local_score) return "away";
  return null; // draw
}

/** Build a BracketMatchVm from a hydrated match */
function buildBracketMatch(match: MatchWithTeams): BracketMatchVm {
  const card = buildMatchCard(match);
  return {
    ...card,
    winnerSide: winnerSide(match),
  };
}

// -- Team info builder ------------------------------------------------------

/**
 * Build the consolidated team identity info view model.
 * Confederation is omitted per spec — the Info card carries only
 * title, federation, and trophies.
 */
function buildTeamInfoVm(country: Country): TeamInfoVm {
  return {
    title: country.name,
    federation: country.federation,
    trophies: country.trophies,
  };
}

// -- Team info builder (Info-card fallback edge cases) ---------------------

/**
 * Test-ready pure function: fill fallback values for an Info card when
 * source data is missing. Keeps the card structurally complete without
 * inventing content.
 */
export function fillInfoFallbacks(info: TeamInfoVm): TeamInfoVm {
  return {
    title: info.title || FALLBACK.teamName,
    federation: info.federation ?? null,
    trophies: info.trophies ?? null,
  };
}

// -- Roster helpers ---------------------------------------------------------

/** Position display-label mapping */
const POSITION_GROUPS: Record<string, TeamRosterGroupVm["label"]> = {
  GK: "Goalkeepers",
  DF: "Defenders",
  MF: "Midfielders",
  FW: "Forwards",
};

/**
 * Derive a position group label from the raw `position` field.
 * Multi-position values like "DF,MF" map to the first listed position.
 * Empty or unrecognized positions fall to "Utility".
 */
function positionGroupLabel(position: string): TeamRosterGroupVm["label"] {
  if (!position) return "Utility";
  const primary = position.split(",")[0].trim().toUpperCase();
  return POSITION_GROUPS[primary] ?? "Utility";
}

const GROUP_ORDER: TeamRosterGroupVm["label"][] = [
  "Goalkeepers",
  "Defenders",
  "Midfielders",
  "Forwards",
  "Utility",
];

/**
 * Dedupe duplicate player rows by preferring the lowest `player.id`
 * for each unique (name + position + current_club) key. This handles
 * the known Czech Republic duplication issue without modifying the DB.
 */
function dedupePlayers(players: PlayerWithCountry[]): PlayerWithCountry[] {
  const best = new Map<string, PlayerWithCountry>();
  for (const p of players) {
    const key = `${p.name}|${p.position}|${p.current_club ?? ""}`;
    const existing = best.get(key);
    if (!existing || p.id < existing.id) {
      best.set(key, p);
    }
  }
  return Array.from(best.values());
}

/**
 * Build grouped roster view models from hydrated player rows.
 * Dedupes, groups by position, and returns an explicit empty-state flag.
 */
function buildRosterGroups(players: PlayerWithCountry[]): {
  groups: TeamRosterGroupVm[];
  isEmpty: boolean;
} {
  const deduped = dedupePlayers(players);
  const byGroup = new Map<TeamRosterGroupVm["label"], TeamPlayerVm[]>();

  for (const groupLabel of GROUP_ORDER) {
    byGroup.set(groupLabel, []);
  }

  for (const p of deduped) {
    const label = positionGroupLabel(p.position);
    const vm: TeamPlayerVm = {
      name: p.name,
      position: p.position || "Unknown",
      age: p.age,
      club: p.current_club,
    };
    byGroup.get(label)!.push(vm);
  }

  // Only include groups that have players
  const groups: TeamRosterGroupVm[] = [];
  for (const label of GROUP_ORDER) {
    const players = byGroup.get(label)!;
    if (players.length > 0) {
      groups.push({ label, players });
    }
  }

  return { groups, isEmpty: deduped.length === 0 };
}

/**
 * Test-ready pure function: shape a single player row into a roster row VM.
 * number and photoUrl are forward-compatible slots (currently null until
 * jersey_number / player_photo columns are added to the DB).
 */
export function shapeRosterRow(player: PlayerWithCountry): TeamRosterRowVm {
  return {
    name: player.name,
    position: player.position || "Unknown",
    age: player.age,
    club: player.current_club,
    number: null, // Forward-compatible: not yet in DB schema
    photoUrl: null, // Forward-compatible: not yet in DB schema
  };
}

/**
 * Build flat roster-row view models from hydrated player rows.
 * Dedupes and returns a flat list of TeamRosterRowVm for the
 * scan-friendly listing/table format.
 */
function buildRosterRows(players: PlayerWithCountry[]): TeamRosterRowVm[] {
  return dedupePlayers(players).map(shapeRosterRow);
}

/**
 * Determine formation display state.
 * A non-null, non-empty formation string is "published".
 * A null or empty formation is "unpublished" — shown as explicit unavailable state.
 */
function buildFormationState(formation: string | null): FormationState {
  if (formation && formation.trim().length > 0) {
    return { value: formation, status: "published" };
  }
  return { value: null, status: "unpublished" };
}

// -- Third-place ranking builder -------------------------------------------

/** Number of third-place teams that advance in a 48-team / 12-group format */
const THIRD_PLACE_ADVANCING_COUNT = 8;

/**
 * Build the best-third-place ranking across all groups.
 * Teams are ranked by points, then goal difference, then goals for.
 *
 * Data completeness: advancing status is only assigned when ALL groups
 * have enough standings rows to identify every third-place team. Before
 * that threshold, rows are returned for groups that do have data, but
 * every row shows advancing=false — the cross-group comparison would be
 * misleading on partial data.
 */
function buildThirdPlaceRanking(
  groups: Group[],
  standings: StandingWithCountry[],
): ThirdPlaceRankingResult {
  const byGroup = new Map<number, StandingWithCountry[]>();
  for (const s of standings) {
    const list = byGroup.get(s.group_id) ?? [];
    list.push(s);
    byGroup.set(s.group_id, list);
  }

  // Collect third-place rows (rank 3 in each group)
  // Track how many groups have enough data (3+ standings rows)
  const thirdPlaceRows: {
    standing: StandingWithCountry;
    groupName: string;
    groupSlug: string;
  }[] = [];

  let groupsWithData = 0;

  for (const group of groups) {
    const groupStandings = byGroup.get(group.id);
    if (groupStandings && groupStandings.length >= 3) {
      groupsWithData++;

      // Sort standings by points desc, then GD, then GF — same as display order
      const sorted = [...groupStandings].sort((a, b) => {
        const ptsDiff = (b.points ?? 0) - (a.points ?? 0);
        if (ptsDiff !== 0) return ptsDiff;
        const bGd = (b.goals_for ?? 0) - (b.goals_against ?? 0);
        const aGd = (a.goals_for ?? 0) - (a.goals_against ?? 0);
        if (bGd !== aGd) return bGd - aGd;
        return (b.goals_for ?? 0) - (a.goals_for ?? 0);
      });

      const third = sorted[2];
      thirdPlaceRows.push({
        standing: third,
        groupName: group.name,
        groupSlug: group.slug,
      });
    }
  }

  // Data is complete only when every group has 3+ standings rows
  const dataComplete = groupsWithData === groups.length && groups.length > 0;

  // If no groups have data at all, return empty
  if (thirdPlaceRows.length === 0) {
    return { rows: [], dataComplete: false };
  }

  // Rank third-place teams across groups by points, GD, GF
  const ranked = thirdPlaceRows
    .map(({ standing, groupName }) => {
      const country = standing.country;
      const gf = standing.goals_for ?? 0;
      const ga = standing.goals_against ?? 0;
      return {
        rank: 0, // assigned below
        teamName: country?.name ?? FALLBACK.teamName,
        teamSlug: country?.slug ?? null,
        flagUrl: country?.flag_url ?? null,
        groupName,
        matchesPlayed: standing.matches_played ?? 0,
        wins: standing.wins ?? 0,
        draws: standing.draws ?? 0,
        losses: standing.losses ?? 0,
        goalsFor: gf,
        goalsAgainst: ga,
        goalDifference: gf - ga,
        points: standing.points ?? 0,
        advancing: false, // assigned below
      };
    })
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.goalDifference !== a.goalDifference)
        return b.goalDifference - a.goalDifference;
      return b.goalsFor - a.goalsFor;
    });

  // Assign rank; advancing only when data is complete
  for (let i = 0; i < ranked.length; i++) {
    ranked[i].rank = i + 1;
    ranked[i].advancing = dataComplete && i < THIRD_PLACE_ADVANCING_COUNT;
  }

  return { rows: ranked, dataComplete };
}

// -- Bracket connection builder ---------------------------------------------

/**
 * Derive bracket connection metadata from match.next_match_id values.
 * Only includes connections where next_match_id is populated (not null),
 * producing explicit advancement links that the bracket can render visually.
 * When next_match_id is null across all matches, returns an empty array
 * and the bracket degrades gracefully to round-only display.
 */
function buildBracketConnections(
  knockoutMatches: MatchWithTeams[],
): BracketConnectionVm[] {
  const connections: BracketConnectionVm[] = [];
  for (const match of knockoutMatches) {
    if (match.next_match_id != null) {
      connections.push({
        fromMatchId: match.id,
        toMatchId: match.next_match_id,
      });
    }
  }
  return connections;
}

// -- Landing view model builder ---------------------------------------------

export function buildLandingVm(
  groups: Group[],
  standings: StandingWithCountry[],
  knockoutMatches: MatchWithTeams[],
  errors: string[],
): LandingVm {
  // Index standings by group_id
  const byGroup = new Map<number, StandingWithCountry[]>();
  for (const s of standings) {
    const list = byGroup.get(s.group_id) ?? [];
    list.push(s);
    byGroup.set(s.group_id, list);
  }

  // Build group view models
  const groupVms: GroupStandingsVm[] = groups.map((g) => {
    const raw = byGroup.get(g.id) ?? [];
    const rows = raw.map((s, i) => buildStandingRow(s, i + 1));
    return {
      groupSlug: g.slug,
      groupName: g.name,
      rows,
    };
  });

  // Build knockout bracket entries
  const bracketVms = knockoutMatches.map(buildBracketMatch);

  // Build third-place cross-group ranking
  const { rows: thirdPlaceRanking, dataComplete: thirdPlaceDataComplete } =
    buildThirdPlaceRanking(groups, standings);

  // Build bracket connection metadata from next_match_id
  const bracketConnections = buildBracketConnections(knockoutMatches);

  return {
    groups: groupVms,
    knockout: bracketVms,
    thirdPlaceRanking,
    thirdPlaceDataComplete,
    bracketConnections,
    errors,
  };
}

// -- Team detail view model builder -----------------------------------------

export function buildTeamDetailVm(
  country: Country,
  standings: StandingWithCountry[],
  matches: MatchWithTeams[],
  players: PlayerWithCountry[],
): TeamDetailVm {
  const paletteHero = parseTeamColors(country.colors, "hero");
  const paletteBadge = parseTeamColors(country.colors, "badge");
  const themeToken = textToThemeToken(country.colors);
  const rosterGroups = buildRosterGroups(players);
  const rosterRows = buildRosterRows(players);

  return {
    hero: {
      name: country.name,
      slug: country.slug,
      flagUrl: country.flag_url,
      emblemUrl: country.emblem_url,
      federation: country.federation,
      trophies: country.trophies,
      palette: paletteHero,
    },
    info: buildTeamInfoVm(country),
    roster: {
      groups: rosterGroups.groups,
      rows: rosterRows,
      isEmpty: rosterGroups.isEmpty,
    },
    formation: buildFormationState(country.formation),
    standings: standings.map((s, i) => buildStandingRow(s, i + 1)),
    matches: matches.map(buildMatchCard),
    palette: paletteBadge,
    themeToken,
  };
}

// -- Jornada fixtures view model --------------------------------------------

export type JornadaFixturesVm = {
  label: string;
  matches: MatchCardVm[];
};

// -- Group detail view model ------------------------------------------------

export type GroupDetailVm = {
  group: GroupStandingsVm;
  fixtures: JornadaFixturesVm[];
  errors: string[];
};

// -- Jornada assignment helper -----------------------------------------------

/** Day-gap threshold for separating matchdays in the group stage */
const JORNADA_DAY_GAP = 3;

/**
 * Cluster sorted group-stage matches into jornadas (matchdays).
 * Consecutive matches within JORNADA_DAY_GAP days of each other share a
 * matchday label. When a gap exceeds the threshold, a new matchday begins.
 * Matches without a date are placed in a final "Schedule TBD" group.
 */
function assignJornadas(matches: MatchWithTeams[]): JornadaFixturesVm[] {
  if (matches.length === 0) return [];

  // Separate matches with and without dates
  const dated: MatchWithTeams[] = [];
  const undated: MatchWithTeams[] = [];
  for (const m of matches) {
    if (m.date) dated.push(m);
    else undated.push(m);
  }

  const jornadas: JornadaFixturesVm[] = [];
  let jornadaIdx = 1;
  let currentMatches: MatchCardVm[] = [];
  let lastTimestamp: number | null = null;

  for (const match of dated) {
    const ts = new Date(match.date!).getTime();

    if (lastTimestamp !== null) {
      const dayDiff = Math.abs(ts - lastTimestamp) / 86_400_000;
      if (dayDiff > JORNADA_DAY_GAP) {
        jornadas.push({
          label: `Matchday ${jornadaIdx}`,
          matches: currentMatches,
        });
        jornadaIdx++;
        currentMatches = [];
      }
    }

    currentMatches.push(buildMatchCard(match));
    lastTimestamp = ts;
  }

  // Flush remaining dated matches
  if (currentMatches.length > 0) {
    jornadas.push({
      label: `Matchday ${jornadaIdx}`,
      matches: currentMatches,
    });
  }

  // Append undated matches in a trailing group
  if (undated.length > 0) {
    jornadas.push({
      label: "Schedule TBD",
      matches: undated.map(buildMatchCard),
    });
  }

  return jornadas;
}

// -- Group detail view model builder -----------------------------------------

export function buildGroupDetailVm(
  group: Group,
  standings: StandingWithCountry[],
  matches: MatchWithTeams[],
  errors: string[],
): GroupDetailVm {
  const rows = standings.map((s, i) => buildStandingRow(s, i + 1));
  const fixtures = assignJornadas(matches);

  return {
    group: { groupSlug: group.slug, groupName: group.name, rows },
    fixtures,
    errors,
  };
}
