// ---------------------------------------------------------------------------
// Third-place ranking — best 8 third-place teams across groups,
// showing advancement status with an explicit rule explanation.
// Degrades to a rule-only card when data is too incomplete.
// ---------------------------------------------------------------------------

import Link from "next/link";
import type { ThirdPlaceRowVm } from "@/lib/tournament/view-models";

/** Number of third-place teams that advance in a 48-team / 12-group format */
const THIRD_PLACE_ADVANCING_COUNT = 8;

type ThirdPlaceRankingProps = {
  rows: ThirdPlaceRowVm[];
  /** True only when every group has enough standings data to make
   *  advancement status meaningful. When false, the ranking table is
   *  shown but no team is marked as advancing. */
  dataComplete: boolean;
};

export function ThirdPlaceRanking({
  rows,
  dataComplete,
}: ThirdPlaceRankingProps) {
  const hasRows = rows.length > 0;

  return (
    <section className="overflow-hidden rounded-[var(--radius-soft)] border border-white/10 bg-[var(--surface)]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
        <h3 className="font-heading text-sm font-bold tracking-wide text-white">
          Best Third-Place Teams
        </h3>
        <span className="text-xs uppercase tracking-widest text-slate-500">
          Advancement
        </span>
      </div>

      {/* Rule explanation — always visible */}
      <div className="border-b border-white/5 px-4 py-2 text-xs leading-relaxed text-slate-400">
        The top 8 third-placed teams across all groups advance to the Round of
        32. Ranking is by points, then goal difference, then goals scored.
      </div>

      {hasRows && !dataComplete ? (
        /* Partial data — show table without advancement indicators */
        <>
          <table className="w-full text-left font-mono text-xs leading-tight">
            <thead>
              <tr className="text-[0.65rem] uppercase tracking-widest text-slate-500">
                <th className="w-6 px-2 py-1.5" aria-label="Status" />
                <th className="w-6 px-1 py-1.5">#</th>
                <th className="px-2 py-1.5">Team</th>
                <th className="px-2 py-1.5 text-[0.65rem]">Group</th>
                <th className="px-1 py-1.5 text-center">P</th>
                <th className="px-1 py-1.5 text-center">GD</th>
                <th className="px-2 py-1.5 text-right">Pts</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => {
                const isEven = idx % 2 === 1;
                return (
                  <tr
                    key={row.rank}
                    className={[
                      isEven ? "bg-white/[0.02]" : "",
                      "border-t border-white/5 transition-colors hover:bg-white/[0.05]",
                    ].join(" ")}
                  >
                    {/* No advancement indicator when data is incomplete */}
                    <td className="px-2 py-1.5">
                      <span
                        className="inline-block h-3 w-1 rounded-full bg-transparent"
                        aria-label="Pending"
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
                    <td className="px-2 py-1.5 text-[0.65rem] text-slate-500">
                      {row.groupName}
                    </td>
                    <td className="px-1 py-1.5 text-center text-slate-400">
                      {row.matchesPlayed}
                    </td>
                    <td className="px-1 py-1.5 text-center text-slate-400">
                      {row.goalDifference > 0
                        ? `+${row.goalDifference}`
                        : row.goalDifference}
                    </td>
                    <td className="px-2 py-1.5 text-right font-bold text-white">
                      {row.points}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="border-t border-white/5 px-4 py-2 text-xs leading-relaxed text-amber-400/80">
            Not all groups have reported standings yet — advancement status is
            pending. Rankings will update as more results come in.
          </div>
        </>
      ) : hasRows && dataComplete ? (
        /* Full data — show ranking table with advancement indicators */
        <table className="w-full text-left font-mono text-xs leading-tight">
          <thead>
            <tr className="text-[0.65rem] uppercase tracking-widest text-slate-500">
              <th className="w-6 px-2 py-1.5" aria-label="Status" />
              <th className="w-6 px-1 py-1.5">#</th>
              <th className="px-2 py-1.5">Team</th>
              <th className="px-2 py-1.5 text-[0.65rem]">Group</th>
              <th className="px-1 py-1.5 text-center">P</th>
              <th className="px-1 py-1.5 text-center">GD</th>
              <th className="px-2 py-1.5 text-right">Pts</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const isEven = idx % 2 === 1;
              const isCutoff = row.rank === THIRD_PLACE_ADVANCING_COUNT + 1;
              return (
                <tr
                  key={row.rank}
                  className={[
                    isEven ? "bg-white/[0.02]" : "",
                    isCutoff
                      ? "border-t border-dashed border-white/20"
                      : "",
                    "border-t border-white/5 transition-colors hover:bg-white/[0.05]",
                  ].join(" ")}
                >
                  {/* Advancement indicator */}
                  <td className="px-2 py-1.5">
                    <span
                      className={`inline-block h-3 w-1 rounded-full ${
                        row.advancing
                          ? "bg-[var(--accent-gold)]"
                          : "bg-transparent"
                      }`}
                      title={row.advancing ? "Advancing" : "Eliminated"}
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
                  <td className="px-2 py-1.5 text-[0.65rem] text-slate-500">
                    {row.groupName}
                  </td>
                  <td className="px-1 py-1.5 text-center text-slate-400">
                    {row.matchesPlayed}
                  </td>
                  <td className="px-1 py-1.5 text-center text-slate-400">
                    {row.goalDifference > 0
                      ? `+${row.goalDifference}`
                      : row.goalDifference}
                  </td>
                  <td className="px-2 py-1.5 text-right font-bold text-white">
                    {row.points}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        /* No data at all — show explicit unavailable state */
        <div className="px-4 py-6 text-sm text-slate-500">
          Standings data is not yet complete enough to determine which
          third-place teams are advancing. Check back as group matches progress.
        </div>
      )}

      {/* Legend — only shown when data is complete */}
      {dataComplete && rows.length > 0 && (
        <div className="flex items-center gap-4 border-t border-white/5 px-4 py-1.5 text-[0.6rem] uppercase tracking-widest text-slate-500">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-1 rounded-full bg-[var(--accent-gold)]" />
            Top 8 — Advancing
          </span>
        </div>
      )}
    </section>
  );
}