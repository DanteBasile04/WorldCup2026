// ---------------------------------------------------------------------------
// Bracket — knockout bracket from Round of 32 through the Final.
// Groups matches by round, shows placeholder slots for unknown data.
// ---------------------------------------------------------------------------

import Link from "next/link";
import type { BracketMatchVm } from "@/lib/tournament/view-models";
import { FALLBACK } from "@/lib/tournament/presentation";

type BracketProps = {
  matches: BracketMatchVm[];
};

/** Ordered round keys for display */
const ROUND_ORDER: string[] = [
  "round_of_32",
  "round_of_16",
  "quarter_final",
  "semi_final",
  "third_place",
  "final",
];

/** Label map */
const ROUND_LABELS: Record<string, string> = {
  round_of_32: "Round of 32",
  round_of_16: "Round of 16",
  quarter_final: "Quarter-finals",
  semi_final: "Semi-finals",
  third_place: "Third place",
  final: "Final",
};

/** Group matches by round in display order */
function groupByRound(matches: BracketMatchVm[]): Map<string, BracketMatchVm[]> {
  const map = new Map<string, BracketMatchVm[]>();
  for (const round of ROUND_ORDER) {
    map.set(round, []);
  }
  for (const m of matches) {
    const list = map.get(m.round) ?? [];
    list.push(m);
    map.set(m.round, list);
  }
  return map;
}

/** Render a single team name with optional link */
function TeamSlot({
  name,
  slug,
  isWinner,
  isLoser,
}: {
  name: string;
  slug: string | null;
  isWinner: boolean;
  isLoser: boolean;
}) {
  const nameClass = isWinner
    ? "text-[var(--accent-gold)] font-bold"
    : isLoser
      ? "text-slate-500"
      : "text-white";

  if (slug) {
    return (
      <Link
        href={`/teams/${slug}`}
        className={`${nameClass} hover:text-[var(--accent-gold)] transition-colors`}
      >
        {name}
      </Link>
    );
  }
  return <span className={nameClass}>{name}</span>;
}

/** Render a single bracket match */
function BracketMatch({ vm }: { vm: BracketMatchVm }) {
  const isHomeWinner = vm.winnerSide === "home";
  const isAwayWinner = vm.winnerSide === "away";
  const isHomeLoser = vm.winnerSide === "away";
  const isAwayLoser = vm.winnerSide === "home";

  return (
    <div className="flex flex-col gap-0.5 rounded-[var(--radius-soft)] border border-white/5 bg-white/[0.02] px-3 py-2 font-mono text-xs">
      {/* Round label — small, above the match */}
      <span className="mb-0.5 text-[0.6rem] uppercase tracking-widest text-slate-500">
        {vm.roundLabel}
      </span>

      {/* Home */}
      <div className="flex items-center justify-between gap-2">
        <TeamSlot
          name={vm.homeName}
          slug={vm.homeSlug}
          isWinner={isHomeWinner}
          isLoser={isHomeLoser}
        />
        <span
          className={
            isHomeWinner
              ? "font-bold text-[var(--accent-gold)]"
              : isHomeLoser
                ? "text-slate-500"
                : "text-slate-400"
          }
        >
          {vm.homeScore}
        </span>
      </div>

      {/* Away */}
      <div className="flex items-center justify-between gap-2">
        <TeamSlot
          name={vm.awayName}
          slug={vm.awaySlug}
          isWinner={isAwayWinner}
          isLoser={isAwayLoser}
        />
        <span
          className={
            isAwayWinner
              ? "font-bold text-[var(--accent-gold)]"
              : isAwayLoser
                ? "text-slate-500"
                : "text-slate-400"
          }
        >
          {vm.awayScore}
        </span>
      </div>

      {/* Venue / date */}
      <div className="mt-0.5 text-[0.6rem] text-slate-500">
        {vm.venue !== FALLBACK.venue ? vm.venue : null}
        {vm.venue !== FALLBACK.venue && vm.date ? " · " : null}
        {vm.date
          ? new Intl.DateTimeFormat("en", { dateStyle: "short" }).format(new Date(vm.date))
          : null}
      </div>
    </div>
  );
}

/** Render an empty placeholder slot for a round that has no data yet */
function PlaceholderSlot({ roundLabel }: { roundLabel: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-[var(--radius-soft)] border border-dashed border-white/10 bg-white/[0.01] px-3 py-2 font-mono text-xs">
      <span className="text-[0.6rem] uppercase tracking-widest text-slate-500">
        {roundLabel}
      </span>
      <span className="text-slate-600">{FALLBACK.teamName}</span>
      <span className="text-slate-600">{FALLBACK.teamName}</span>
    </div>
  );
}

export function Bracket({ matches }: BracketProps) {
  const byRound = groupByRound(matches);

  return (
    <div className="flex flex-wrap gap-6">
      {ROUND_ORDER.map((round) => {
        const label = ROUND_LABELS[round] ?? round;
        const roundMatches = byRound.get(round) ?? [];
        const showPlaceholder = roundMatches.length === 0;

        return (
          <div key={round} className="flex flex-col gap-2">
            {/* Round column header */}
            <h3 className="font-heading text-xs font-bold uppercase tracking-widest text-slate-400">
              {label}
            </h3>

            {/* Matches or placeholders */}
            {showPlaceholder ? (
              <PlaceholderSlot roundLabel={label} />
            ) : (
              roundMatches.map((m) => <BracketMatch key={m.id} vm={m} />)
            )}
          </div>
        );
      })}
    </div>
  );
}
