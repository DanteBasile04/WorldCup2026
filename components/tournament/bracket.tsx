// ---------------------------------------------------------------------------
// Bracket — knockout bracket from Round of 32 through the Final.
// Renders an explicit round-grid layout with progression chevrons between
// rounds on desktop, and stacked rounds on mobile.
// Degrades gracefully when advancement links are absent.
// ---------------------------------------------------------------------------

import { Fragment } from "react";
import Link from "next/link";
import type { BracketMatchVm, BracketConnectionVm } from "@/lib/tournament/view-models";
import {
  buildBracketGridRounds,
  resolveConnectorDisplay,
  BRACKET_ROUND_ORDER,
  BRACKET_ROUND_LABELS,
  THIRD_PLACE_ROUND,
} from "@/lib/tournament/view-models";
import type { BracketGridRound, BracketConnectorState } from "@/lib/tournament/view-models";
import { FALLBACK } from "@/lib/tournament/presentation";

type BracketProps = {
  matches: BracketMatchVm[];
  /** Explicit advancement links derived from match.next_match_id */
  connections?: BracketConnectionVm[];
};

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

/** Render a single bracket match card */
function BracketMatchCard({ vm }: { vm: BracketMatchVm }) {
  const isHomeWinner = vm.winnerSide === "home";
  const isAwayWinner = vm.winnerSide === "away";
  const isHomeLoser = vm.winnerSide === "away";
  const isAwayLoser = vm.winnerSide === "home";

  return (
    <div className="flex flex-col gap-0.5 rounded-[var(--radius-soft)] border border-white/5 bg-white/[0.02] px-4 py-2.5 text-sm">
      {/* Round label — small, above the match */}
      <span className="mb-0.5 text-[0.65rem] uppercase tracking-widest text-slate-500">
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
    <div className="flex flex-col gap-0.5 rounded-[var(--radius-soft)] border border-dashed border-white/10 bg-white/[0.01] px-4 py-3 text-sm">
      <span className="text-[0.65rem] uppercase tracking-widest text-slate-500">
        {roundLabel}
      </span>
      <span className="text-slate-600">{FALLBACK.teamName}</span>
      <span className="text-slate-600">{FALLBACK.teamName}</span>
    </div>
  );
}

/** Connector indicator for matches receiving winners from previous rounds */
function ConnectorIndicator({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-1 text-[0.65rem] text-slate-500">
      <svg
        className="h-3 w-3 shrink-0"
        viewBox="0 0 12 12"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        aria-hidden="true"
      >
        <path d="M6 1v4M3 5l3-1 3 1" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span>{label}</span>
    </div>
  );
}

/** Progression chevron between bracket round columns on desktop */
function RoundChevron() {
  return (
    <div className="flex flex-none flex-col items-center justify-center px-1 pt-8">
      <svg
        className="h-5 w-5 text-slate-600"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M8 4l6 6-6 6V4z" />
      </svg>
    </div>
  );
}

/** Build a lookup from match ID to incoming connection match IDs */
function buildIncomingMap(
  connections: BracketConnectionVm[],
): Map<number, number[]> {
  const map = new Map<number, number[]>();
  for (const conn of connections) {
    const list = map.get(conn.toMatchId) ?? [];
    list.push(conn.fromMatchId);
    map.set(conn.toMatchId, list);
  }
  return map;
}

/** Render a round column's matches (shared between desktop and mobile) */
function RoundColumn({
  gridRound,
  incomingMap,
  connectorState,
}: {
  gridRound: BracketGridRound;
  incomingMap: Map<number, number[]>;
  connectorState: BracketConnectorState;
}) {
  if (gridRound.isEmpty) {
    return <PlaceholderSlot roundLabel={gridRound.label} />;
  }

  return (
    <>
      {gridRound.matches.map((m) => {
        const incomingIds = incomingMap.get(m.id);
        const hasIncoming = connectorState.safe.length > 0 && incomingIds && incomingIds.length > 0;
        const connectorLabel = connectorState.degraded ? "Advances" : "Winner advances";

        return (
          <div key={m.id} className="flex flex-col gap-1">
            {hasIncoming && <ConnectorIndicator label={connectorLabel} />}
            <BracketMatchCard vm={m} />
          </div>
        );
      })}
    </>
  );
}

export function Bracket({ matches, connections = [] }: BracketProps) {
  // Separate third-place match from the main winner-progression bracket
  const mainBracketMatches = matches.filter((m) => m.round !== THIRD_PLACE_ROUND);
  const thirdPlaceMatches = matches.filter((m) => m.round === THIRD_PLACE_ROUND);

  const mainMatchIds = new Set(mainBracketMatches.map((m) => m.id));
  const connectorState = resolveConnectorDisplay(connections, mainMatchIds);
  const incomingMap = buildIncomingMap(connectorState.safe);
  const gridRounds = buildBracketGridRounds(
    mainBracketMatches,
    BRACKET_ROUND_ORDER,
    BRACKET_ROUND_LABELS,
  );
  const hasAnyData = matches.length > 0;
  const hasThirdPlace = thirdPlaceMatches.length > 0;

  return (
    <div className="flex flex-col gap-8">
      {/* Empty state — no knockout data at all */}
      {!hasAnyData && (
        <div className="rounded-[var(--radius-soft)] border border-dashed border-white/10 bg-white/[0.02] p-8 text-center text-sm text-slate-500">
          The knockout bracket will appear here when match data becomes available.
          {connectorState.degraded &&
            " Some advancement links may be incomplete."}
        </div>
      )}

      {/* Desktop: round columns with progression chevrons between rounds */}
      {hasAnyData && (
        <div className="hidden md:block overflow-x-auto">
          <div className="min-w-[64rem] py-2">
            <div className="flex items-start justify-center gap-1">
              {gridRounds.map((gridRound, roundIdx) => (
                <Fragment key={gridRound.round}>
                  {roundIdx > 0 && <RoundChevron />}
                  <div className="flex min-w-[9rem] flex-1 flex-col gap-2">
                    {/* Round column header with separator */}
                    <div className="border-b border-white/10 pb-2">
                      <h3 className="font-heading text-xs font-bold uppercase tracking-widest text-slate-400">
                        {gridRound.label}
                      </h3>
                    </div>

                    {/* Match slots or placeholder */}
                    <RoundColumn
                      gridRound={gridRound}
                      incomingMap={incomingMap}
                      connectorState={connectorState}
                    />
                  </div>
                </Fragment>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Mobile: stacked rounds */}
      {hasAnyData && (
        <div className="flex flex-col gap-6 md:hidden">
          {gridRounds.map((gridRound) => (
            <div key={gridRound.round} className="flex flex-col gap-2">
              <div className="border-b border-white/10 pb-2">
                <h3 className="font-heading text-xs font-bold uppercase tracking-widest text-slate-400">
                  {gridRound.label}
                </h3>
              </div>

              <RoundColumn
                gridRound={gridRound}
                incomingMap={incomingMap}
                connectorState={connectorState}
              />
            </div>
          ))}
        </div>
      )}

      {/* Third Place match — separate surface below the main bracket */}
      {hasThirdPlace && (
        <div className="rounded-[var(--radius-soft)] border border-dashed border-[var(--accent-gold)]/30 bg-[var(--accent-gold)]/[0.02] p-5">
          <h3 className="font-heading text-xs font-bold uppercase tracking-widest text-[var(--accent-gold)]">
            Third-place play-off
          </h3>
          <p className="mt-1 mb-4 text-xs text-slate-500">
            The winner earns third place — this match does not advance to the final.
          </p>
          <div className="flex flex-col gap-2">
            {thirdPlaceMatches.map((m) => (
              <div key={m.id} className="flex flex-col gap-0.5">
                <BracketMatchCard vm={m} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}