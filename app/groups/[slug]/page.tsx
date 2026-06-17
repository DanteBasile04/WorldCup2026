import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getGroupPageData } from "@/lib/supabase/queries";
import { buildGroupDetailVm } from "@/lib/tournament/view-models";
import type { StandingRowVm } from "@/lib/tournament/view-models";
import { MatchCard } from "@/components/tournament/match-card";

export const revalidate = 300;

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const result = await getGroupPageData(slug);

  return {
    title: result.data.group
      ? `${result.data.group.name} | World Cup 2026`
      : "Group | World Cup 2026",
  };
}

/** Zone indicator styling for standings rows */
function zoneBar(zone: StandingRowVm["zone"]) {
  switch (zone) {
    case "qualified":
      return "bg-[var(--accent-gold)]";
    case "playoff":
      return "bg-[var(--accent-crimson)]";
    case "none":
      return "bg-transparent";
  }
}

export default async function GroupPage({ params }: PageProps) {
  const { slug } = await params;
  const result = await getGroupPageData(slug);
  const { group, standings, matches } = result.data;

  if (!group && !result.error) {
    notFound();
  }

  const errors = result.error ? [result.error] : [];
  const vm = group ? buildGroupDetailVm(group, standings, matches, errors) : null;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-8 px-6 py-10 sm:px-10">
      <Link
        href="/"
        className="font-heading text-sm font-semibold text-[var(--accent-gold)] hover:underline"
      >
        &larr; Back to overview
      </Link>

      {/* Error notice */}
      {vm && vm.errors.length > 0 ? (
        <div className="rounded-[var(--radius-soft)] border border-amber-300/30 bg-amber-300/10 p-4 text-sm text-amber-100">
          {vm.errors.join(" ")}
        </div>
      ) : null}

      {vm ? (
        <>
          {/* Group hero */}
          <section className="glass-strong rounded-[var(--radius-hero)] p-8">
            <p className="font-heading text-sm font-semibold uppercase tracking-[0.3em] text-[var(--accent-crimson-light)]">
              Group
            </p>
            <h1 className="font-heading mt-4 text-4xl font-bold text-white sm:text-5xl">
              {vm.group.groupName}
            </h1>
          </section>

          {/* Standings */}
          <section className="overflow-hidden rounded-[var(--radius-card)] border border-white/10 bg-[var(--surface)]">
            <div className="border-b border-white/10 px-6 py-4">
              <h2 className="font-heading text-lg font-bold tracking-wide text-white">
                Standings
              </h2>
            </div>

            {vm.group.rows.length === 0 ? (
              <div className="px-6 py-8 text-sm text-slate-500">
                No standings available for this group yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left font-mono text-xs leading-tight">
                  <thead>
                    <tr className="text-[0.65rem] uppercase tracking-widest text-slate-500">
                      <th className="w-6 px-3 py-2" aria-label="Zone" />
                      <th className="w-6 px-2 py-2">#</th>
                      <th className="px-3 py-2">Team</th>
                      <th className="px-2 py-2 text-center">MP</th>
                      <th className="px-2 py-2 text-center">W</th>
                      <th className="px-2 py-2 text-center">D</th>
                      <th className="px-2 py-2 text-center">L</th>
                      <th className="px-2 py-2 text-center">GF</th>
                      <th className="px-2 py-2 text-center">GA</th>
                      <th className="px-2 py-2 text-center">GD</th>
                      <th className="px-3 py-2 text-right">Pts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vm.group.rows.map((row, idx) => {
                      const isEven = idx % 2 === 1;
                      return (
                        <tr
                          key={row.rank}
                          className={[
                            isEven ? "bg-white/[0.02]" : "",
                            "border-t border-white/5 transition-colors hover:bg-white/[0.05]",
                          ].join(" ")}
                        >
                          {/* Zone bar */}
                          <td className="px-3 py-2.5">
                            <span
                              className={`inline-block h-4 w-1 rounded-full ${zoneBar(row.zone)}`}
                              title={row.zone}
                            />
                          </td>
                          <td className="px-2 py-2.5 text-slate-500">{row.rank}</td>
                          <td className="px-3 py-2.5 font-sans text-xs font-medium">
                            {row.teamSlug ? (
                              <Link
                                href={`/teams/${row.teamSlug}`}
                                className="text-white hover:text-[var(--accent-gold)]"
                              >
                                {row.teamName}
                              </Link>
                            ) : (
                              <span className="text-slate-500">{row.teamName}</span>
                            )}
                          </td>
                          <td className="px-2 py-2.5 text-center text-slate-400">
                            {row.matchesPlayed}
                          </td>
                          <td className="px-2 py-2.5 text-center text-slate-400">
                            {row.wins}
                          </td>
                          <td className="px-2 py-2.5 text-center text-slate-400">
                            {row.draws}
                          </td>
                          <td className="px-2 py-2.5 text-center text-slate-400">
                            {row.losses}
                          </td>
                          <td className="px-2 py-2.5 text-center text-slate-400">
                            {row.goalsFor}
                          </td>
                          <td className="px-2 py-2.5 text-center text-slate-400">
                            {row.goalsAgainst}
                          </td>
                          <td className="px-2 py-2.5 text-center text-slate-400">
                            {row.goalDifference > 0
                              ? `+${row.goalDifference}`
                              : row.goalDifference}
                          </td>
                          <td className="px-3 py-2.5 text-right font-bold text-white">
                            {row.points}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Zone legend */}
            <div className="flex items-center gap-4 border-t border-white/5 px-6 py-2 text-[0.6rem] uppercase tracking-widest text-slate-500">
              <span className="flex items-center gap-1">
                <span className="inline-block h-2.5 w-1 rounded-full bg-[var(--accent-gold)]" />
                Qualified
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-2.5 w-1 rounded-full bg-[var(--accent-crimson)]" />
                Playoff
              </span>
            </div>
          </section>

          {/* Fixtures by jornada */}
          <section className="rounded-[var(--radius-card)] border border-white/10 bg-[var(--surface)] p-6">
            <h2 className="font-heading text-lg font-bold tracking-wide text-white">
              Fixtures
            </h2>

            {vm.fixtures.length === 0 ? (
              <div className="mt-4 rounded-[var(--radius-soft)] border border-dashed border-white/10 bg-white/[0.02] p-6 text-sm text-slate-500">
                No fixtures available for this group yet.
              </div>
            ) : (
              <div className="mt-4 grid gap-6">
                {vm.fixtures.map((jornada) => (
                  <div key={jornada.label}>
                    <h3 className="font-heading mb-2 text-sm font-bold uppercase tracking-widest text-[var(--accent-gold)]">
                      {jornada.label}
                    </h3>
                    <div className="grid gap-2">
                      {jornada.matches.map((m) => (
                        <MatchCard key={m.id} vm={m} showMeta />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      ) : null}
    </main>
  );
}
