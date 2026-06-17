// ---------------------------------------------------------------------------
// Match card — compact match row with mono labels, winner-gold,
// subdued loser, and TBD placeholders for incomplete data.
// ---------------------------------------------------------------------------

import Link from "next/link";
import type { MatchCardVm } from "@/lib/tournament/view-models";
import { FALLBACK } from "@/lib/tournament/presentation";

type MatchCardProps = {
  vm: MatchCardVm;
  /** Whether to show round label inline (useful in fixture lists) */
  showRound?: boolean;
  /** Whether to show venue and date below the score row */
  showMeta?: boolean;
};

export function MatchCard({ vm, showRound = false, showMeta = false }: MatchCardProps) {
  const isFinished = vm.status === "finished";
  const isScheduled = vm.status === "scheduled";

  const hasVenue = vm.venue !== FALLBACK.venue;
  const formattedDate = vm.date
    ? new Intl.DateTimeFormat("en", { dateStyle: "short" }).format(new Date(vm.date))
    : null;

  return (
    <div className="rounded-[var(--radius-soft)] border border-white/5 bg-white/[0.02] px-3 py-2 font-mono text-xs">
      <div className="flex items-center gap-3">
        {/* Round badge (optional) */}
        {showRound ? (
          <span className="shrink-0 text-[0.6rem] uppercase tracking-widest text-slate-500">
            {vm.roundLabel}
          </span>
        ) : null}

        {/* Home team */}
        <span className="flex-1 text-right">
          {vm.homeSlug ? (
            <Link
              href={`/teams/${vm.homeSlug}`}
              className="text-white hover:text-[var(--accent-gold)] transition-colors"
            >
              {vm.homeName}
            </Link>
          ) : (
            <span className="text-slate-500">{vm.homeName}</span>
          )}
        </span>

        {/* Score block */}
        <span className="flex shrink-0 items-center gap-1.5 rounded bg-white/[0.04] px-2 py-0.5">
          <span className="font-bold text-white">{vm.homeScore}</span>
          <span className="text-slate-500">{"\u2013"}</span>
          <span className="font-bold text-white">{vm.awayScore}</span>
        </span>

        {/* Away team */}
        <span className="flex-1">
          {vm.awaySlug ? (
            <Link
              href={`/teams/${vm.awaySlug}`}
              className="text-white hover:text-[var(--accent-gold)] transition-colors"
            >
              {vm.awayName}
            </Link>
          ) : (
            <span className="text-slate-500">{vm.awayName}</span>
          )}
        </span>

        {/* Metadata */}
        <span className="shrink-0 text-[0.6rem] uppercase tracking-widest text-slate-500">
          {isScheduled ? "Upcoming" : isFinished ? "FT" : vm.status}
        </span>
      </div>

      {/* Venue / date line (when showMeta is true) */}
      {showMeta && (hasVenue || formattedDate) ? (
        <div className="mt-1 text-[0.6rem] text-slate-500">
          {hasVenue ? vm.venue : null}
          {hasVenue && formattedDate ? " \u00B7 " : null}
          {formattedDate}
        </div>
      ) : null}
    </div>
  );
}
