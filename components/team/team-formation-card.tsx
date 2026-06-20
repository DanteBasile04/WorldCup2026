// ---------------------------------------------------------------------------
// Team formation card — renders the published formation graphic when available,
// prefers structured metadata for the label, and keeps an explicit unpublished
// state when no safe publishable formation can be shown.
// ---------------------------------------------------------------------------

import type { FormationState } from "@/lib/tournament/view-models";
import type { TeamThemeToken } from "@/lib/tournament/presentation";

type TeamFormationCardProps = {
  formation: FormationState;
  themeToken: TeamThemeToken;
};

export function TeamFormationCard({ formation, themeToken }: TeamFormationCardProps) {
  const accent = themeToken.isNeutral
    ? "var(--accent-crimson)"
    : themeToken.accent;

  return (
    <section
      className="rounded-[var(--radius-card)] border border-white/10 bg-[var(--surface)] p-6"
      style={{ borderTopColor: accent, borderTopWidth: 3 }}
    >
      <h2 className="font-heading text-lg font-bold tracking-wide text-white">
        Formation
      </h2>

      {formation.status === "published" ? (
        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-heading text-3xl font-bold text-white">
              {formation.value}
            </span>
            <span className="inline-block rounded bg-[var(--accent-gold)]/20 px-2 py-0.5 text-[0.65rem] uppercase tracking-wide text-[var(--accent-gold)]">
              Published
            </span>
          </div>

          {formation.svg ? (
            <div className="overflow-hidden rounded-[var(--radius-soft)] border border-white/10 bg-[#03130b] p-3 shadow-inner shadow-black/20 [&_svg]:h-auto [&_svg]:w-full [&_svg]:max-w-full">
              <div dangerouslySetInnerHTML={{ __html: formation.svg }} />
            </div>
          ) : (
            <div className="rounded-[var(--radius-soft)] border border-dashed border-white/10 bg-white/[0.02] p-4 text-sm text-slate-400">
              The published formation graphic is not available in storage yet.
            </div>
          )}
        </div>
      ) : (
        <div className="mt-4 rounded-[var(--radius-soft)] border border-dashed border-white/10 bg-white/[0.02] p-6 text-sm text-slate-500">
          Formation has not been published yet.
        </div>
      )}
    </section>
  );
}
