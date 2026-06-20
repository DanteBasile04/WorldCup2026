import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadEnvFile } from "./fbref-player-export.mjs";

export function createTeamRosterSource({ rosterFixtureDir = null } = {}) {
  const fixtureDirectory = rosterFixtureDir ? resolve(process.cwd(), rosterFixtureDir) : null;

  return {
    async loadTeamRoster({ teamSlug, teamName }) {
      if (fixtureDirectory) {
        return loadFixtureRoster({ fixtureDirectory, teamSlug, teamName });
      }

      return loadSupabaseRoster({ teamSlug, teamName });
    },
  };
}

function loadFixtureRoster({ fixtureDirectory, teamSlug, teamName }) {
  const candidates = [
    resolve(fixtureDirectory, `${teamSlug}.players.json`),
    resolve(fixtureDirectory, `${teamSlug}.json`),
  ];

  const fixturePath = candidates.find((candidate) => existsSync(candidate));

  if (!fixturePath) {
    throw new Error(
      `No roster fixture found for ${teamSlug}. Expected ${teamSlug}.players.json or ${teamSlug}.json under ${fixtureDirectory}.`,
    );
  }

  const payload = JSON.parse(readFileSync(fixturePath, "utf8"));
  const players = Array.isArray(payload) ? payload : payload?.players;

  if (!Array.isArray(players)) {
    throw new Error(`Roster fixture ${fixturePath} must be an array or an object with players[].`);
  }

  return {
    players,
    source: {
      type: "fixture",
      path: fixturePath,
      team_slug: teamSlug,
      team_name: teamName ?? payload?.country?.name ?? null,
    },
  };
}

async function loadSupabaseRoster({ teamSlug, teamName }) {
  loadEnvFile(".env.local");
  loadEnvFile(".env");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.SUPABASE_COUNTRY_IMPORT_KEY ??
    process.env.SUPABASE_SECRET_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Supabase read credentials are not configured. Set env vars or use --roster-fixture-dir <dir>.",
    );
  }

  const supabase = createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
    global: {
      headers: {
        "X-Client-Info": "wc26-team-shirt-number-matcher",
      },
    },
  });

  const countryResponse = await supabase
    .from("country")
    .select("id,name,slug")
    .eq("slug", teamSlug)
    .maybeSingle();

  if (countryResponse.error) {
    throw new Error(`Could not load country ${teamSlug} from Supabase: ${countryResponse.error.message}`);
  }

  const country = countryResponse.data;

  if (!country) {
    throw new Error(`No Supabase country row matched slug ${teamSlug}${teamName ? ` (${teamName})` : ""}.`);
  }

  const playerResponse = await supabase
    .from("player")
    .select("id,name,position,country_id")
    .eq("country_id", country.id)
    .order("id", { ascending: true });

  if (playerResponse.error) {
    throw new Error(`Could not load players for ${teamSlug} from Supabase: ${playerResponse.error.message}`);
  }

  return {
    players: playerResponse.data ?? [],
    source: {
      type: "supabase",
      team_slug: country.slug,
      team_name: country.name,
      country_id: country.id,
    },
  };
}
