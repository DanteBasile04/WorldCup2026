# Tasks: Tournament MVP Shell

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 800–1100 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1: Foundation → PR 2: Data+Landing → PR 3: Details |
| Delivery strategy | ask-on-risk |
| Chain strategy | feature-branch-chain |

Decision needed before apply: Resolved
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Theme tokens + typography + presentation helpers | PR 1 | ~200-280 lines; base: main or feature/tracker |
| 2 | Queries + view models + landing shell + components | PR 2 | ~350-450 lines; depends on PR 1 |
| 3 | Group detail + team detail + section-card polish | PR 3 | ~200-300 lines; depends on PR 2 |

## Phase 1: Foundation — Theme + Helpers

- [x] 1.1 Modify `app/globals.css` — add CSS custom properties for obsidian surfaces, crimson/gold accents, spacing rhythm, blur/glass utilities, soft rounding
- [x] 1.2 Modify `app/layout.tsx` — import Montserrat (headlines), Plus Jakarta Sans (body), JetBrains Mono (scores); set root font vars
- [x] 1.3 Create `lib/tournament/presentation.ts` — fallback labels (TBD team/score/venue/status), score formatting, density flags, safe team-color parser with contrast check

## Phase 2: Data Layer — Queries + View Models

- [x] 2.1 Modify `lib/supabase/queries.ts` — add landing query (group standings + knockout matches with `phase=knockout`, `group_id=null`, `round_of_32`+), team detail query, shared hydration entry points
- [x] 2.2 Create `lib/tournament/view-models.ts` — define and build `StandingRowVm`, `BracketMatchVm` (winnerSide), `GroupStandingsVm`, `LandingVm`, `TeamDetailVm`; emit qualification/winner/loser emphasis flags

## Phase 3: Core UI — Landing Shell + Components

- [x] 3.1 Create `components/tournament/tab-bar.tsx` — server-rendered Groups/Knockout links with gold active underline
- [x] 3.2 Create `components/tournament/standings-card.tsx` — compact group ranking card with zebra rows, qualification bars, team links
- [x] 3.3 Create `components/tournament/bracket.tsx` — round_of_32→final bracket skeleton with placeholder slots for unknown data
- [x] 3.4 Create `components/tournament/match-card.tsx` — compact match row with mono labels, winner-gold, subdued loser, TBD placeholders
- [x] 3.5 Modify `app/page.tsx` — wire searchParams, consume LandingVm, render premium hero + tab-bar + Groups/Knockout panels

## Phase 4: Detail Pages + Polish

- [x] 4.1 Modify `app/groups/[slug]/page.tsx` — consume GroupStandingsVm, render standings table + jornada-grouped fixtures with team links
- [x] 4.2 Modify `app/teams/[slug]/page.tsx` — consume TeamDetailVm, render branded profile with safe color accents, formation-in-progress status
- [x] 4.3 Modify `components/ui/section-card.tsx` — align surface with obsidian/glass variants from theme tokens

## Phase 5: Verification

- [x] 5.1 Manual — verify landing renders at `/` without auth, tabs switch, group cards show placeholders
- [x] 5.2 Manual — verify `/groups/[slug]` shows standings ranking + jornada fixtures + team navigation
- [x] 5.3 Manual — verify `/teams/[slug]` renders with safe color defaults and formation status
- [x] 5.4 Manual — verify knockout bracket shows round_of_32 structure with placeholders for missing data
