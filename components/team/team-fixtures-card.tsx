// ---------------------------------------------------------------------------
// Team fixtures card — wraps MatchCard list with an explicit empty state.
// First-class section card that preserves known match data and shows a
// clear fallback when no fixtures are available.
// ---------------------------------------------------------------------------

import type { MatchCardVm } from "@/lib/tournament/view-models";
import { MatchCard } from "@/components/tournament/match-card";

type TeamFixturesCardProps = {
  matches: MatchCardVm[];
};

export function TeamFixturesCard({ matches }: TeamFixturesCardProps) {
  return (
    <section className="rounded-[var(--radius-card)] border border-white/10 bg-[var(--surface)] p-6">
      <h2 className="font-heading text-lg font-bold tracking-wide text-white">
        Fixtures
      </h2>

      {matches.length === 0 ? (
        <div className="mt-4 rounded-[var(--radius-soft)] border border-dashed border-white/10 bg-white/[0.02] p-6 text-sm text-slate-500">
          No fixtures are available for this team yet.
        </div>
      ) : (
        <div className="mt-4 grid gap-2">
          {matches.map((m) => (
            <MatchCard key={m.id} vm={m} showRound showMeta />
          ))}
        </div>
      )}
    </section>
  );
}