// ---------------------------------------------------------------------------
// Standings card — compact group ranking card with zebra rows,
// qualification bars, and team navigation links.
// ---------------------------------------------------------------------------

import Link from "next/link";
import type { GroupStandingsVm, StandingRowVm } from "@/lib/tournament/view-models";

type StandingsCardProps = {
  vm: GroupStandingsVm;
};

/** Zone indicator styling */
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

export function StandingsCard({ vm }: StandingsCardProps) {
  return (
    <article className="overflow-hidden rounded-[var(--radius-soft)] border border-white/10 bg-[var(--surface)]">
      {/* Group header */}
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
        <Link
          href={`/groups/${vm.groupSlug}`}
          className="font-heading text-sm font-bold tracking-wide text-white hover:text-[var(--accent-gold)]"
        >
          {vm.groupName}
        </Link>
        <span className="text-xs uppercase tracking-widest text-slate-500">
          Group
        </span>
      </div>

      {/* Standings table */}
      <table className="w-full text-left font-mono text-xs leading-tight">
        <thead>
          <tr className="text-[0.65rem] uppercase tracking-widest text-slate-500">
            <th className="w-6 px-2 py-1.5" aria-label="Zone" />
            <th className="w-6 px-1 py-1.5">#</th>
            <th className="px-2 py-1.5">Team</th>
            <th className="px-1 py-1.5 text-center">P</th>
            <th className="px-1 py-1.5 text-center">W</th>
            <th className="px-1 py-1.5 text-center">D</th>
            <th className="px-1 py-1.5 text-center">L</th>
            <th className="px-1 py-1.5 text-center">GD</th>
            <th className="px-2 py-1.5 text-right">Pts</th>
          </tr>
        </thead>
        <tbody>
          {vm.rows.map((row, idx) => {
            const isEven = idx % 2 === 1;
            return (
              <tr
                key={row.rank}
                className={[
                  isEven ? "bg-white/[0.02]" : "",
                  "border-t border-white/5 transition-colors hover:bg-white/[0.05]",
                ].join(" ")}
              >
                {/* Qualification zone bar */}
                <td className="px-2 py-1.5">
                  <span
                    className={`inline-block h-3 w-1 rounded-full ${zoneBar(row.zone)}`}
                    title={row.zone}
                  />
                </td>
                <td className="px-1 py-1.5 text-slate-500">{row.rank}</td>
                <td className="px-2 py-1.5 font-sans text-xs font-medium">
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
                <td className="px-1 py-1.5 text-center text-slate-400">
                  {row.matchesPlayed}
                </td>
                <td className="px-1 py-1.5 text-center text-slate-400">
                  {row.wins}
                </td>
                <td className="px-1 py-1.5 text-center text-slate-400">
                  {row.draws}
                </td>
                <td className="px-1 py-1.5 text-center text-slate-400">
                  {row.losses}
                </td>
                <td className="px-1 py-1.5 text-center text-slate-400">
                  {row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}
                </td>
                <td className="px-2 py-1.5 text-right font-bold text-white">
                  {row.points}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Zone legend */}
      <div className="flex items-center gap-4 border-t border-white/5 px-4 py-1.5 text-[0.6rem] uppercase tracking-widest text-slate-500">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-1 rounded-full bg-[var(--accent-gold)]" />
          Qualified
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-1 rounded-full bg-[var(--accent-crimson)]" />
          Playoff
        </span>
      </div>
    </article>
  );
}
