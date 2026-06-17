// ---------------------------------------------------------------------------
// Team formation card — displays the current formation value or an explicit
// unpublished/unavailable state. Follows the spec contract: show formation
// when published, show "not published yet" copy when absent, never invent.
// ---------------------------------------------------------------------------

import type { FormationState } from "@/lib/tournament/view-models";

type TeamFormationCardProps = {
  formation: FormationState;
};

export function TeamFormationCard({ formation }: TeamFormationCardProps) {
  return (
    <section className="rounded-[var(--radius-card)] border border-white/10 bg-[var(--surface)] p-6">
      <h2 className="font-heading text-lg font-bold tracking-wide text-white">
        Formation
      </h2>

      {formation.status === "published" ? (
        <div className="mt-4 flex items-center gap-3">
          <span className="font-heading text-3xl font-bold text-white">
            {formation.value}
          </span>
          <span className="inline-block rounded bg-[var(--accent-gold)]/20 px-2 py-0.5 text-[0.65rem] uppercase tracking-wide text-[var(--accent-gold)]">
            Published
          </span>
        </div>
      ) : (
        <div className="mt-4 rounded-[var(--radius-soft)] border border-dashed border-white/10 bg-white/[0.02] p-6 text-sm text-slate-500">
          Formation has not been published yet.
        </div>
      )}
    </section>
  );
}