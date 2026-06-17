import { getLandingData } from "@/lib/supabase/queries";
import { buildLandingVm } from "@/lib/tournament/view-models";
import { TabBar } from "@/components/tournament/tab-bar";
import { StandingsCard } from "@/components/tournament/standings-card";
import { Bracket } from "@/components/tournament/bracket";

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

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-6 py-10 sm:px-10">
      {/* Premium hero */}
      <section className="glass-strong rounded-[var(--radius-hero)] p-8">
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
      </section>

      {/* Error notice */}
      {vm.errors.length > 0 ? (
        <div className="rounded-[var(--radius-soft)] border border-amber-300/30 bg-amber-300/10 p-4 text-sm text-amber-100">
          {vm.errors.join(" ")}
        </div>
      ) : null}

      {/* Tab bar */}
      <TabBar activeView={activeView} />

      {/* Groups panel */}
      {activeView === "groups" && (
        <section>
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
        </section>
      )}

      {/* Knockout panel */}
      {activeView === "knockout" && (
        <section>
          {vm.knockout.length === 0 ? (
            <div className="rounded-[var(--radius-soft)] border border-dashed border-white/10 bg-white/[0.02] p-6 text-sm text-slate-500">
              Knockout bracket data is not yet available. Placeholder structure
              is shown below.
            </div>
          ) : null}
          <Bracket matches={vm.knockout} />
        </section>
      )}
    </main>
  );
}
