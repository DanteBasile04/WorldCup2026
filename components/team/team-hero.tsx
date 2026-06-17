// ---------------------------------------------------------------------------
// Team hero — flag-dominant background treatment with lateral crest accent.
// The flag image fills the hero surface; the crest appears as a side accent.
// Team metadata (federation, trophies, confederation) is NOT duplicated here —
// it lives in the TeamInfo card. Only the team name and accent bar remain.
// Consumes TeamThemeToken for per-team color identity.
// ---------------------------------------------------------------------------

import Image from "next/image";
import type { TeamHeroVm } from "@/lib/tournament/view-models";

type TeamHeroProps = {
  vm: TeamHeroVm;
};

export function TeamHero({ vm }: TeamHeroProps) {
  const accent = vm.palette.isNeutral
    ? "var(--accent-crimson)"
    : vm.palette.accent;
  const accentMuted = vm.palette.isNeutral
    ? "rgba(196, 30, 58, 0.3)"
    : vm.palette.accentMuted;

  return (
    <section
      className="glass-strong relative flex min-h-[14rem] w-full items-center overflow-hidden rounded-[var(--radius-hero)]"
      style={{ borderColor: accentMuted }}
    >
      {/* Flag-dominant background */}
      {vm.flagUrl ? (
        <div className="absolute inset-0">
          <Image
            src={vm.flagUrl}
            alt={`${vm.name} flag`}
            fill
            className="object-cover opacity-30"
            sizes="100vw"
            unoptimized
            priority
          />
          {/* Gradient overlay for text readability */}
          <div className="absolute inset-0 bg-gradient-to-r from-[var(--surface)] via-[var(--surface)]/80 to-transparent" />
        </div>
      ) : (
        /* Fallback gradient when no flag is available */
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(to right, var(--surface), ${accentMuted})`,
          }}
        />
      )}

      {/* Accent bar */}
      <div
        className="absolute left-6 top-6 h-1 w-16 rounded-full"
        style={{ backgroundColor: accent }}
      />

      {/* Content — name + lateral crest */}
      <div className="relative z-10 flex w-full items-center gap-6 px-8 py-8 sm:px-12">
        {/* Team name */}
        <div className="min-w-0 flex-1">
          <p className="font-heading text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
            Team
          </p>
          <h1 className="font-heading mt-2 text-4xl font-bold text-white sm:text-5xl">
            {vm.name}
          </h1>
        </div>

        {/* Lateral crest accent */}
        {vm.emblemUrl ? (
          <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-full border-2 border-white/10 bg-white/5 sm:h-28 sm:w-28">
            <Image
              src={vm.emblemUrl}
              alt={`${vm.name} crest`}
              fill
              className="object-contain p-2"
              sizes="112px"
              unoptimized
            />
          </div>
        ) : null}
      </div>
    </section>
  );
}