// ---------------------------------------------------------------------------
// Team Info card — consolidated identity metadata for title, federation,
// and trophies. Merchandises theme accents from the resolved
// TeamThemeToken while keeping text and card readability intact.
// Confederation is intentionally excluded per spec — it duplicates
// what federation already conveys.
// ---------------------------------------------------------------------------

import type { TeamInfoVm } from "@/lib/tournament/view-models";
import type { TeamThemeToken } from "@/lib/tournament/presentation";

type TeamInfoCardProps = {
  info: TeamInfoVm;
  themeToken: TeamThemeToken;
};

/** Fallback label when a field is missing, keeping the card structurally complete */
function fieldLabel(value: string | null, fallback: string): string {
  return value ?? fallback;
}

export function TeamInfoCard({ info, themeToken }: TeamInfoCardProps) {
  const accent = themeToken.isNeutral
    ? "var(--accent-crimson)"
    : themeToken.accent;

  return (
    <section
      className="rounded-[var(--radius-card)] border border-white/10 bg-[var(--surface)] p-6"
      style={{ borderTopColor: accent, borderTopWidth: 3 }}
    >
      {/* Team title */}
      <h2 className="font-heading text-2xl font-bold tracking-wide text-white">
        {info.title}
      </h2>

      {/* Metadata rows */}
      <div className="mt-4 space-y-2">
        <p className="text-sm leading-6 text-slate-300">
          <span className="font-semibold text-white">Federation:</span>{" "}
          {fieldLabel(info.federation, "To be confirmed")}
        </p>

        {info.trophies ? (
          <p className="text-sm leading-6">
            <span className="font-semibold text-white">Trophies:</span>{" "}
            <span className="text-[var(--accent-gold)]">{info.trophies}</span>
          </p>
        ) : null}
      </div>
    </section>
  );
}