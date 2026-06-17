import { createSupabaseServerClient, getSupabaseConfig } from "./server";
import type { Country, Group, GroupStanding, Match } from "./database.types";

export type QueryResult<T> = {
  data: T;
  error: string | null;
};

export type MatchWithTeams = Match & {
  group: Group | null;
  localCountry: Country | null;
  awayCountry: Country | null;
};

export type StandingWithCountry = GroupStanding & {
  country: Country | null;
};

function missingConfigResult<T>(fallback: T): QueryResult<T> | null {
  const config = getSupabaseConfig();

  if (!config.ok) {
    return {
      data: fallback,
      error: `Missing Supabase environment: ${config.missing.join(", ")}`,
    };
  }

  return null;
}

function byId<T extends { id: number }>(items: T[]) {
  return new Map(items.map((item) => [item.id, item]));
}

async function getCountriesByIds(ids: number[]) {
  const uniqueIds = Array.from(new Set(ids.filter(Number.isFinite)));

  if (uniqueIds.length === 0) {
    return new Map<number, Country>();
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("country")
    .select("*")
    .in("id", uniqueIds);

  if (error) {
    throw new Error(error.message);
  }

  return byId(data ?? []);
}

async function getGroupsByIds(ids: number[]) {
  const uniqueIds = Array.from(new Set(ids.filter(Number.isFinite)));

  if (uniqueIds.length === 0) {
    return new Map<number, Group>();
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.from("grp").select("*").in("id", uniqueIds);

  if (error) {
    throw new Error(error.message);
  }

  return byId(data ?? []);
}

async function hydrateMatches(matches: Match[]): Promise<MatchWithTeams[]> {
  const countryIds = matches.flatMap((match) => [
    match.local_country_id,
    match.away_country_id,
  ]).filter((id): id is number => typeof id === "number");
  const groupIds = matches
    .map((match) => match.group_id)
    .filter((id): id is number => typeof id === "number");

  const [countries, groups] = await Promise.all([
    getCountriesByIds(countryIds),
    getGroupsByIds(groupIds),
  ]);

  return matches.map((match) => ({
    ...match,
    group: match.group_id ? (groups.get(match.group_id) ?? null) : null,
    localCountry: match.local_country_id
      ? (countries.get(match.local_country_id) ?? null)
      : null,
    awayCountry: match.away_country_id
      ? (countries.get(match.away_country_id) ?? null)
      : null,
  }));
}

export async function getGroups(limit = 12): Promise<QueryResult<Group[]>> {
  const missing = missingConfigResult<Group[]>([]);
  if (missing) return missing;

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("grp")
    .select("*")
    .order("name", { ascending: true })
    .limit(limit);

  return { data: data ?? [], error: error?.message ?? null };
}

export async function getCountries(limit = 12): Promise<QueryResult<Country[]>> {
  const missing = missingConfigResult<Country[]>([]);
  if (missing) return missing;

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("country")
    .select("*")
    .order("name", { ascending: true })
    .limit(limit);

  return { data: data ?? [], error: error?.message ?? null };
}

export async function getUpcomingMatches(limit = 6): Promise<QueryResult<MatchWithTeams[]>> {
  const missing = missingConfigResult<MatchWithTeams[]>([]);
  if (missing) return missing;

  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("match")
      .select("*")
      .eq("status", "scheduled")
      .order("date", { ascending: true })
      .limit(limit);

    if (error) {
      return { data: [], error: error.message };
    }

    return { data: await hydrateMatches(data ?? []), error: null };
  } catch (error) {
    return { data: [], error: error instanceof Error ? error.message : "Unknown error" };
  }
}

export async function getGroupPageData(slug: string): Promise<
  QueryResult<{
    group: Group | null;
    standings: StandingWithCountry[];
    matches: MatchWithTeams[];
  }>
> {
  const fallback = { group: null, standings: [], matches: [] };
  const missing = missingConfigResult<typeof fallback>(fallback);
  if (missing) return missing;

  try {
    const supabase = createSupabaseServerClient();
    const { data: group, error: groupError } = await supabase
      .from("grp")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();

    if (groupError) {
      return { data: fallback, error: groupError.message };
    }

    if (!group) {
      return { data: fallback, error: null };
    }

    const [standingsResponse, matchesResponse] = await Promise.all([
      supabase
        .from("group_standing")
        .select("*")
        .eq("group_id", group.id)
        .order("points", { ascending: false })
        .order("goals_for", { ascending: false }),
      supabase
        .from("match")
        .select("*")
        .eq("group_id", group.id)
        .order("date", { ascending: true }),
    ]);

    if (standingsResponse.error) {
      return { data: fallback, error: standingsResponse.error.message };
    }

    if (matchesResponse.error) {
      return { data: fallback, error: matchesResponse.error.message };
    }

    const standings = standingsResponse.data ?? [];
    const countries = await getCountriesByIds(standings.map((standing) => standing.country_id));

    return {
      data: {
        group,
        standings: standings.map((standing) => ({
          ...standing,
          country: countries.get(standing.country_id) ?? null,
        })),
        matches: await hydrateMatches(matchesResponse.data ?? []),
      },
      error: null,
    };
  } catch (error) {
    return { data: fallback, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

// ---------------------------------------------------------------------------
// Landing data — all group standings + knockout matches in one call
// ---------------------------------------------------------------------------

export type LandingData = {
  groups: Group[];
  standings: StandingWithCountry[];
  knockoutMatches: MatchWithTeams[];
};

export async function getLandingData(): Promise<QueryResult<LandingData>> {
  const fallback: LandingData = { groups: [], standings: [], knockoutMatches: [] };
  const missing = missingConfigResult<LandingData>(fallback);
  if (missing) return missing;

  try {
    const supabase = createSupabaseServerClient();

    const [groupsRes, standingsRes, knockoutRes] = await Promise.all([
      supabase.from("grp").select("*").order("name", { ascending: true }),
      supabase
        .from("group_standing")
        .select("*")
        .order("group_id", { ascending: true })
        .order("points", { ascending: false })
        .order("goals_for", { ascending: false }),
      supabase
        .from("match")
        .select("*")
        .eq("phase", "knockout")
        .is("group_id", null)
        .order("date", { ascending: true }),
    ]);

    if (groupsRes.error) {
      return { data: fallback, error: groupsRes.error.message };
    }
    if (standingsRes.error) {
      return { data: fallback, error: standingsRes.error.message };
    }
    if (knockoutRes.error) {
      return { data: fallback, error: knockoutRes.error.message };
    }

    const standings = standingsRes.data ?? [];

    // Hydrate standings with country data
    const countryIds = standings.map((s) => s.country_id);
    const countries = await getCountriesByIds(countryIds);

    const standingsWithCountry: StandingWithCountry[] = standings.map((s) => ({
      ...s,
      country: countries.get(s.country_id) ?? null,
    }));

    return {
      data: {
        groups: groupsRes.data ?? [],
        standings: standingsWithCountry,
        knockoutMatches: await hydrateMatches(knockoutRes.data ?? []),
      },
      error: null,
    };
  } catch (error) {
    return {
      data: fallback,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ---------------------------------------------------------------------------
// Team detail data — single country + standings + matches
// ---------------------------------------------------------------------------

export type TeamDetailData = {
  country: Country | null;
  standings: StandingWithCountry[];
  matches: MatchWithTeams[];
};

export async function getTeamDetailData(slug: string): Promise<QueryResult<TeamDetailData>> {
  const fallback: TeamDetailData = { country: null, standings: [], matches: [] };
  const missing = missingConfigResult<TeamDetailData>(fallback);
  if (missing) return missing;

  try {
    const supabase = createSupabaseServerClient();
    const { data: country, error: countryError } = await supabase
      .from("country")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();

    if (countryError) {
      return { data: fallback, error: countryError.message };
    }
    if (!country) {
      return { data: fallback, error: null };
    }

    const [standingsRes, matchesRes] = await Promise.all([
      supabase
        .from("group_standing")
        .select("*")
        .eq("country_id", country.id)
        .order("points", { ascending: false }),
      supabase
        .from("match")
        .select("*")
        .or(`local_country_id.eq.${country.id},away_country_id.eq.${country.id}`)
        .order("date", { ascending: true }),
    ]);

    if (standingsRes.error) {
      return { data: fallback, error: standingsRes.error.message };
    }
    if (matchesRes.error) {
      return { data: fallback, error: matchesRes.error.message };
    }

    return {
      data: {
        country,
        standings: (standingsRes.data ?? []).map((s) => ({ ...s, country })),
        matches: await hydrateMatches(matchesRes.data ?? []),
      },
      error: null,
    };
  } catch (error) {
    return {
      data: fallback,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function getCountryPageData(slug: string): Promise<
  QueryResult<{
    country: Country | null;
    standings: StandingWithCountry[];
    matches: MatchWithTeams[];
  }>
> {
  const fallback = { country: null, standings: [], matches: [] };
  const missing = missingConfigResult<typeof fallback>(fallback);
  if (missing) return missing;

  try {
    const supabase = createSupabaseServerClient();
    const { data: country, error: countryError } = await supabase
      .from("country")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();

    if (countryError) {
      return { data: fallback, error: countryError.message };
    }

    if (!country) {
      return { data: fallback, error: null };
    }

    const [standingsResponse, matchesResponse] = await Promise.all([
      supabase
        .from("group_standing")
        .select("*")
        .eq("country_id", country.id)
        .order("points", { ascending: false }),
      supabase
        .from("match")
        .select("*")
        .or(`local_country_id.eq.${country.id},away_country_id.eq.${country.id}`)
        .order("date", { ascending: true }),
    ]);

    if (standingsResponse.error) {
      return { data: fallback, error: standingsResponse.error.message };
    }

    if (matchesResponse.error) {
      return { data: fallback, error: matchesResponse.error.message };
    }

    return {
      data: {
        country,
        standings: (standingsResponse.data ?? []).map((standing) => ({
          ...standing,
          country,
        })),
        matches: await hydrateMatches(matchesResponse.data ?? []),
      },
      error: null,
    };
  } catch (error) {
    return { data: fallback, error: error instanceof Error ? error.message : "Unknown error" };
  }
}
