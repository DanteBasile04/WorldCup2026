import { getLandingData } from "@/lib/supabase/queries";
import { buildLandingVm } from "@/lib/tournament/view-models";
import { TabBar } from "@/components/tournament/tab-bar";
import { StandingsCard } from "@/components/tournament/standings-card";
import { Bracket } from "@/components/tournament/bracket";
import { ThirdPlaceRanking } from "@/components/tournament/third-place-ranking";

export const revalidate = 300;

type SearchParams = Promise<{ view?: string }>;

export default async function Home({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const activeView = params.view === "knockout" ? "knockout" : "groups";

  const landingResult = await getLandingData();
  const errors = landingResult.error ? [landingResult.error] : [];

  const vm = buildLandingVm(
    landingResult.data.groups,
    landingResult.data.standings,
    landingResult.data.knockoutMatches,
    errors,
  );

  const totalTeams = vm.groups.reduce(
    (sum, g) => sum + g.rows.length,
    0,
  );

  // Collect unique flag URLs for the mosaic (deduped, limited)
  const flagUrls = vm.groups
    .flatMap((g) => g.rows.map((r) => r.flagUrl))
    .filter((url): url is string => url != null)
    .filter((url, idx, arr) => arr.indexOf(url) === idx)
    .slice(0, 24);

  return (
    <main className="flex min-h-screen w-full flex-col">
      {/* Full-bleed presentation hero */}
      <section className="glass-strong relative w-full overflow-hidden px-6 py-10 sm:px-12 md:px-20 lg:px-28">
        {/* Flag mosaic background — decorative, low opacity */}
        {flagUrls.length > 0 && (
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.06]"
            aria-hidden="true"
          >
            <div className="grid h-full w-full auto-rows-[2.5rem] grid-cols-6 gap-1.5 sm:grid-cols-8">
              {flagUrls.map((url, i) => (
                <div
                  key={`${url}-${i}`}
                  className="flex items-center justify-center rounded-sm bg-cover bg-center"
                  style={{ backgroundImage: `url(${url})` }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Hero content — inner readable wrapper */}
        <div className="relative z-10 mx-auto max-w-5xl">
          <p className="font-heading text-sm font-semibold uppercase tracking-[0.3em] text-[var(--accent-crimson-light)]">
            FIFA World Cup 2026
          </p>
          <div className="mt-6 grid gap-8 lg:grid-cols-[1.5fr_1fr] lg:items-end">
            <div>
              <h1 className="font-heading max-w-3xl text-4xl font-bold tracking-tight text-white sm:text-6xl">
                Groups, teams, and fixtures in one public read-only hub.
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">
                Browse the current tournament structure from Supabase-backed
                public data. No login is required.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-[var(--radius-soft)] bg-[var(--surface)] p-4">
                <p className="font-heading text-3xl font-bold text-white">
                  {vm.groups.length}
                </p>
                <p className="text-xs uppercase tracking-wide text-slate-400">
                  Groups
                </p>
              </div>
              <div className="rounded-[var(--radius-soft)] bg-[var(--surface)] p-4">
                <p className="font-heading text-3xl font-bold text-white">
                  {totalTeams}
                </p>
                <p className="text-xs uppercase tracking-wide text-slate-400">
                  Teams
                </p>
              </div>
              <div className="rounded-[var(--radius-soft)] bg-[var(--surface)] p-4">
                <p className="font-heading text-3xl font-bold text-white">
                  {vm.knockout.length}
                </p>
                <p className="text-xs uppercase tracking-wide text-slate-400">
                  Knockout
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Error notice — constrained width */}
      {vm.errors.length > 0 && (
        <div className="mx-auto w-full max-w-6xl px-6 pt-6 sm:px-10">
          <div className="rounded-[var(--radius-soft)] border border-amber-300/30 bg-amber-300/10 p-4 text-sm text-amber-100">
            {vm.errors.join(" ")}
          </div>
        </div>
      )}

      {/* Tab bar — constrained width */}
      <div className="mx-auto w-full max-w-6xl px-6 pt-6 sm:px-10">
        <TabBar activeView={activeView} />
      </div>

      {/* Groups panel — constrained readable width */}
      {activeView === "groups" && (
        <section className="mx-auto w-full max-w-6xl px-6 pb-10 pt-6 sm:px-10">
          {vm.groups.length === 0 ? (
            <div className="rounded-[var(--radius-soft)] border border-dashed border-white/10 bg-white/[0.02] p-6 text-sm text-slate-500">
              No group standings are available yet.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {vm.groups.map((g) => (
                <StandingsCard key={g.groupSlug} vm={g} />
              ))}
            </div>
          )}

          {/* Third-place ranking — always rendered so incomplete state is reachable */}
          <ThirdPlaceRanking
            rows={vm.thirdPlaceRanking}
            dataComplete={vm.thirdPlaceDataComplete}
          />
        </section>
      )}

      {/* Knockout panel — wider surface for bracket grid */}
      {activeView === "knockout" && (
        <section className="mx-auto w-full max-w-[90rem] px-6 pb-10 pt-6 sm:px-10">
          {vm.knockout.length === 0 ? (
            <div className="rounded-[var(--radius-soft)] border border-dashed border-white/10 bg-white/[0.02] p-6 text-sm text-slate-500">
              Knockout bracket data is not yet available. Placeholder structure
              is shown below.
            </div>
          ) : null}
          <Bracket
            matches={vm.knockout}
            connections={vm.bracketConnections}
          />
        </section>
      )}
    </main>
  );
}