// ---------------------------------------------------------------------------
// Team roster card — responsive table/listing rows with future-ready column
// slots for jersey number and player photo. Uses the flat TeamRosterRowVm[]
// format instead of grouped lists for scan-friendly display.
// Explicit empty state when no roster data is available.
// ---------------------------------------------------------------------------

import type { TeamRosterRowVm } from "@/lib/tournament/view-models";

type TeamRosterCardProps = {
  rows: TeamRosterRowVm[];
  isEmpty: boolean;
};

/** Map position codes to display labels */
const POSITION_LABELS: Record<string, string> = {
  GK: "GK",
  DF: "DF",
  MF: "MF",
  FW: "FW",
};

function displayPosition(position: string): string {
  if (!position) return "—";
  // For multi-position like "DF,MF", show abbreviated labels
  if (position.includes(",")) {
    return position
      .split(",")
      .map((c) => POSITION_LABELS[c.trim()] ?? c.trim())
      .join("/");
  }
  return POSITION_LABELS[position] ?? position;
}

export function TeamRosterCard({ rows, isEmpty }: TeamRosterCardProps) {
  if (isEmpty) {
    return (
      <section className="rounded-[var(--radius-card)] border border-white/10 bg-[var(--surface)] p-6">
        <h2 className="font-heading text-lg font-bold tracking-wide text-white">
          Roster
        </h2>
        <div className="mt-5 rounded-[var(--radius-soft)] border border-dashed border-white/10 bg-white/[0.02] p-6 text-sm text-slate-500">
          Roster data is not available yet.
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-[var(--radius-card)] border border-white/10 bg-[var(--surface)] p-6">
      <h2 className="font-heading text-lg font-bold tracking-wide text-white">
        Roster
      </h2>

      {/* Responsive table header — visible on sm+ screens */}
      <div className="mt-4 hidden grid-cols-[3rem_1fr_4.5rem_8rem_4rem] gap-3 text-xs font-semibold uppercase tracking-widest text-slate-500 sm:grid">
        <span>#</span>
        <span>Name</span>
        <span>Pos</span>
        <span>Club</span>
        <span>Age</span>
      </div>

      {/* Roster rows */}
      <ul className="mt-2 space-y-1">
        {rows.map((player) => (
          <li
            key={player.name}
            className="grid grid-cols-1 gap-1 rounded-[var(--radius-soft)] px-4 py-2.5 text-sm transition-colors hover:bg-white/[0.03] sm:grid-cols-[3rem_1fr_4.5rem_8rem_4rem] sm:gap-3 sm:items-center"
          >
            {/* Jersey number slot — forward-compatible, hidden until data */}
            <span className="hidden tabular-nums text-slate-500 sm:block">
              {player.number ?? "—"}
            </span>

            {/* Player name */}
            <span className="font-medium text-white">{player.name}</span>

            {/* Position */}
            <span className="text-xs text-slate-400 sm:text-sm">
              {displayPosition(player.position)}
            </span>

            {/* Club */}
            <span className="text-xs text-slate-500 sm:text-sm sm:truncate">
              {player.club ?? "—"}
            </span>

            {/* Age */}
            <span className="tabular-nums text-xs text-slate-500 sm:text-sm">
              {player.age ? `${player.age}` : "—"}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}