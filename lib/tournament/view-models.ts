// ---------------------------------------------------------------------------
// Tournament view models — convert raw query rows into render-safe shapes
// with winner/loser emphasis, qualification markers, and stable fallbacks.
// ---------------------------------------------------------------------------

import {
  FALLBACK,
  formatScore,
  parseTeamColors,
  type TeamPalette,
} from "./presentation";
import type {
  Country,
  Group,
  Match,
} from "@/lib/supabase/database.types";
import type { MatchWithTeams, StandingWithCountry } from "@/lib/supabase/queries";

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

// -- Landing view model -----------------------------------------------------

export type LandingVm = {
  groups: GroupStandingsVm[];
  knockout: BracketMatchVm[];
  errors: string[];
};

// -- Team detail view model -------------------------------------------------

export type TeamDetailVm = {
  name: string;
  slug: string;
  flagUrl: string | null;
  emblemUrl: string | null;
  federation: string | null;
  trophies: string | null;
  formation: string | null;
  palette: TeamPalette;
  standings: StandingRowVm[];
  matches: MatchCardVm[];
};

// -- Helpers ----------------------------------------------------------------

/** Format round enum to display label */
function roundLabel(round: Match["round"]): string {
  if (!round) return FALLBACK.round;
  const map: Record<string, string> = {
    round_of_32: "Round of 32",
    round_of_16: "Round of 16",
    quarter_final: "Quarter-final",
    semi_final: "Semi-final",
    third_place: "Third place",
    final: "Final",
  };
  return map[round] ?? round.replace(/_/g, " ");
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

  return {
    groups: groupVms,
    knockout: bracketVms,
    errors,
  };
}

// -- Team detail view model builder -----------------------------------------

export function buildTeamDetailVm(
  country: Country,
  standings: StandingWithCountry[],
  matches: MatchWithTeams[],
): TeamDetailVm {
  return {
    name: country.name,
    slug: country.slug,
    flagUrl: country.flag_url,
    emblemUrl: country.emblem_url,
    federation: country.federation,
    trophies: country.trophies,
    formation: country.formation,
    palette: parseTeamColors(country.colors, "badge"),
    standings: standings.map((s, i) => buildStandingRow(s, i + 1)),
    matches: matches.map(buildMatchCard),
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
