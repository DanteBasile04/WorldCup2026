import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getTeamDetailData } from "@/lib/supabase/queries";
import { buildTeamDetailVm } from "@/lib/tournament/view-models";
import type { TeamDetailVm } from "@/lib/tournament/view-models";
import { MatchCard } from "@/components/tournament/match-card";

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

/** Profile fact row */
function FactRow({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <p className="text-sm leading-6 text-slate-300">
      <span className="font-semibold text-white">{label}:</span> {value}
    </p>
  );
}

export default async function TeamPage({ params }: PageProps) {
  const { slug } = await params;
  const result = await getTeamDetailData(slug);
  const { country, standings, matches } = result.data;

  if (!country && !result.error) {
    notFound();
  }

  const errors = result.error ? [result.error] : [];
  const vm: TeamDetailVm | null = country
    ? buildTeamDetailVm(country, standings, matches)
    : null;

  // Accent from safe palette (CSS var or hex)
  const accent = vm?.palette.isNeutral
    ? "var(--accent-crimson)"
    : vm?.palette.accent ?? "var(--accent-crimson)";
  const accentMuted = vm?.palette.isNeutral
    ? "rgba(196, 30, 58, 0.3)"
    : vm?.palette.accentMuted ?? "rgba(196, 30, 58, 0.3)";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-8 px-6 py-10 sm:px-10">
      <Link
        href="/"
        className="font-heading text-sm font-semibold text-[var(--accent-gold)] hover:underline"
      >
        &larr; Back to overview
      </Link>

      {/* Error notice */}
      {errors.length > 0 ? (
        <div className="rounded-[var(--radius-soft)] border border-amber-300/30 bg-amber-300/10 p-4 text-sm text-amber-100">
          {errors.join(" ")}
        </div>
      ) : null}

      {vm ? (
        <>
          {/* Team hero with branded accent bar */}
          <section
            className="glass-strong rounded-[var(--radius-hero)] p-8"
            style={{ borderColor: accentMuted }}
          >
            {/* Accent top bar */}
            <div
              className="mb-4 h-1 w-16 rounded-full"
              style={{ backgroundColor: accent }}
            />
            <p className="font-heading text-sm font-semibold uppercase tracking-[0.3em] text-slate-400">
              Team
            </p>
            <h1 className="font-heading mt-3 text-4xl font-bold text-white sm:text-5xl">
              {vm.name}
            </h1>
            <p className="mt-3 text-slate-300">
              {vm.federation ?? "Federation to be confirmed"}
            </p>
          </section>

          {/* Profile + Standing grid */}
          <section className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
            {/* Profile card */}
            <div className="rounded-[var(--radius-card)] border border-white/10 bg-[var(--surface)] p-6">
              <h2 className="font-heading text-lg font-bold tracking-wide text-white">
                Profile
              </h2>

              <div className="mt-5 space-y-1">
                <FactRow label="Federation" value={vm.federation} />
                <FactRow label="Trophies" value={vm.trophies} />

                {/* Colors with accent swatch */}
                <div className="flex items-center gap-2 text-sm leading-6 text-slate-300">
                  <span className="font-semibold text-white">Colors:</span>
                  <span
                    className="inline-block h-3 w-3 shrink-0 rounded-full border border-white/20"
                    style={{ backgroundColor: accent }}
                    title={vm.palette.isNeutral ? "Default accent" : "Team accent"}
                  />
                  {country?.colors ?? "To be confirmed"}
                </div>

                {/* Formation as in-progress */}
                <div className="text-sm leading-6 text-slate-300">
                  <span className="font-semibold text-white">Formation:</span>{" "}
                  {vm.formation ? (
                    <span className="flex items-center gap-1.5">
                      {vm.formation}
                      <span className="inline-block rounded bg-amber-300/20 px-1.5 py-0.5 text-[0.6rem] uppercase tracking-wide text-amber-200">
                        In progress
                      </span>
                    </span>
                  ) : (
                    <span className="text-slate-500">To be confirmed</span>
                  )}
                </div>
              </div>
            </div>

            {/* Tournament position card */}
            <div className="rounded-[var(--radius-card)] border border-white/10 bg-[var(--surface)] p-6">
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
            </div>
          </section>

          {/* Matches */}
          <section className="rounded-[var(--radius-card)] border border-white/10 bg-[var(--surface)] p-6">
            <h2 className="font-heading text-lg font-bold tracking-wide text-white">
              Fixtures
            </h2>

            {vm.matches.length === 0 ? (
              <div className="mt-4 rounded-[var(--radius-soft)] border border-dashed border-white/10 bg-white/[0.02] p-6 text-sm text-slate-500">
                No fixtures are available for this team yet.
              </div>
            ) : (
              <div className="mt-4 grid gap-2">
                {vm.matches.map((m) => (
                  <MatchCard key={m.id} vm={m} showRound showMeta />
                ))}
              </div>
            )}
          </section>
        </>
      ) : null}
    </main>
  );
}
