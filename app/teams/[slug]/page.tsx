import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getTeamDetailData } from "@/lib/supabase/queries";
import { buildTeamDetailVm } from "@/lib/tournament/view-models";
import type { TeamDetailVm } from "@/lib/tournament/view-models";
import { TeamHero } from "@/components/team/team-hero";
import { TeamInfoCard } from "@/components/team/team-info-card";
import { TeamRosterCard } from "@/components/team/team-roster-card";
import { TeamFormationCard } from "@/components/team/team-formation-card";
import { TeamFixturesCard } from "@/components/team/team-fixtures-card";

export const revalidate = 300;

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const result = await getTeamDetailData(slug);

  return {
    title: result.data.country
      ? `${result.data.country.name} | World Cup 2026`
      : "Team | World Cup 2026",
  };
}

/** Qualification zone badge for standings rows */
function zoneLabel(zone: "qualified" | "playoff" | "none") {
  if (zone === "qualified") return "Qualified";
  if (zone === "playoff") return "Playoff";
  return null;
}

function zoneBadgeColor(zone: "qualified" | "playoff" | "none") {
  if (zone === "qualified") return "bg-[var(--accent-gold)] text-black";
  if (zone === "playoff") return "bg-[var(--accent-crimson)] text-white";
  return "";
}

export default async function TeamPage({ params }: PageProps) {
  const { slug } = await params;
  const result = await getTeamDetailData(slug);
  const { country, standings, matches, players } = result.data;

  if (!country && !result.error) {
    notFound();
  }

  const errors = result.error ? [result.error] : [];
  const vm: TeamDetailVm | null = country
    ? buildTeamDetailVm(country, standings, matches, players)
    : null;

  return (
    <main className="flex min-h-screen w-full flex-col">
      {/* Error notice */}
      {errors.length > 0 ? (
        <div className="mx-auto w-full max-w-5xl px-6 pt-6">
          <div className="rounded-[var(--radius-soft)] border border-amber-300/30 bg-amber-300/10 p-4 text-sm text-amber-100">
            {errors.join(" ")}
          </div>
        </div>
      ) : null}

      {vm ? (
        <>
          {/* Full-width hero */}
          <div className="w-full">
            <TeamHero vm={vm.hero} />
          </div>

          {/* Content area — constrained readable width */}
          <div className="mx-auto w-full max-w-6xl px-6 py-10 sm:px-10">
            <Link
              href="/"
              className="mb-8 inline-block font-heading text-sm font-semibold text-[var(--accent-gold)] hover:underline"
            >
              &larr; Back to overview
            </Link>

            {/* Info card — consolidated identity */}
            <TeamInfoCard info={vm.info} themeToken={vm.themeToken} />

            {/* Roster */}
            <div className="mt-8">
              <TeamRosterCard rows={vm.roster.rows} isEmpty={vm.roster.isEmpty} />
            </div>

            {/* Formation */}
            <div className="mt-8">
              <TeamFormationCard formation={vm.formation} themeToken={vm.themeToken} />
            </div>

            {/* Tournament position */}
            <div className="mt-8">
              <section className="rounded-[var(--radius-card)] border border-white/10 bg-[var(--surface)] p-6">
                <h2 className="font-heading text-lg font-bold tracking-wide text-white">
                  Tournament position
                </h2>

                {vm.standings.length === 0 ? (
                  <div className="mt-5 rounded-[var(--radius-soft)] border border-dashed border-white/10 bg-white/[0.02] p-6 text-sm text-slate-500">
                    No standings are available for this team yet.
                  </div>
                ) : (
                  <div className="mt-5 grid gap-3">
                    {vm.standings.map((row) => {
                      const zLabel = zoneLabel(row.zone);
                      return (
                        <div
                          key={row.rank}
                          className="rounded-[var(--radius-soft)] border border-white/10 p-4"
                        >
                          <div className="flex items-center gap-2">
                            <p className="text-sm text-slate-400">Group record</p>
                            {zLabel ? (
                              <span
                                className={`rounded px-1.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide ${zoneBadgeColor(row.zone)}`}
                              >
                                {zLabel}
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1 text-lg font-semibold text-white">
                            {row.points} pts &middot; {row.wins}W {row.draws}D{" "}
                            {row.losses}L
                          </p>
                          <p className="mt-0.5 font-mono text-xs text-slate-500">
                            GF {row.goalsFor} GA {row.goalsAgainst} (
                            {row.goalDifference > 0
                              ? `+${row.goalDifference}`
                              : row.goalDifference}
                            )
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>

            {/* Fixtures */}
            <div className="mt-8">
              <TeamFixturesCard matches={vm.matches} />
            </div>
          </div>
        </>
      ) : null}
    </main>
  );
}
