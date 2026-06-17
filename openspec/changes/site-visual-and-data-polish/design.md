# Design: Site Visual and Data Polish

## Technical Approach

Refine the already-shipped polish through the existing server-route -> Supabase query -> view-model -> presentational-component flow. The next apply round is mostly a layout/composition correction: keep `lib/supabase/queries.ts` read-only, reshape VMs in `lib/tournament/view-models.ts`, and replace stale hero/roster/bracket presentations so `/` and `/teams/[slug]` use full-width desktop surfaces, responsive mobile stacking, and explicit incomplete-data states. Local formation scripts stay local tooling only; no public mutation path is introduced.

## Architecture Decisions

### Decision: Full-width primary surfaces

| Option | Tradeoff | Decision |
|---|---|---|
| Keep `max-w-6xl` / `max-w-5xl` page shells | Preserves current layout, conflicts with updated specs | Reject |
| Use full-bleed route shells with inner readable content wrappers | More layout work, matches new desktop requirement | **Choose** |

**Rationale**: `app/page.tsx` and `app/teams/[slug]/page.tsx` currently cap the whole experience. Only the reading columns should stay constrained; hero/bracket/team surfaces should not.

### Decision: Team identity composition

| Option | Tradeoff | Decision |
|---|---|---|
| Keep metadata in both `TeamHero` and the page-level profile card | Low effort, duplicates meaning and weakens hierarchy | Reject |
| Make the flag the hero background, keep crest as side accent, move title/federation/confederation/trophies into one `Info` card | Requires VM and component reshaping, aligns with spec | **Choose** |

**Rationale**: `components/team/team-hero.tsx` currently renders a thumbnail flag plus duplicated metadata, and `app/teams/[slug]/page.tsx` still has a separate profile block. That implementation is now stale.

### Decision: Roster presentation contract

| Option | Tradeoff | Decision |
|---|---|---|
| Keep grouped decorative lists | Simple, poor scanability, hard to extend with jersey/photo columns | Reject |
| Convert roster to responsive listing/table rows with optional future columns | Slightly denser UI, future-ready | **Choose** |

**Rationale**: `components/team/team-roster-card.tsx` should act like a table system now, not a profile list, because the spec explicitly reserves space for numbers/photos later.

### Decision: Bracket structure

| Option | Tradeoff | Decision |
|---|---|---|
| Keep `flex-wrap` round columns with small connector hints | Reuses current code, still reads like loose cards | Reject |
| Render an explicit round/slot grid and only draw connectors from explicit metadata | More structural work, clearer tournament scan | **Choose** |

**Rationale**: `components/tournament/bracket.tsx` is functional but visually ambiguous. The grid must be explicit even when `next_match_id` is absent.

### Decision: Temporary team-color theming

| Option | Tradeoff | Decision |
|---|---|---|
| Continue parsing only raw hex values | Fast, fails updated textual `country.colors` inputs | Reject |
| Add app-side textual color mapping -> sanitized theme tokens -> neutral fallback | Temporary mapping to maintain, matches current iteration need | **Choose** |

**Rationale**: `lib/tournament/presentation.ts` currently assumes hex-like inputs. The refined spec needs a fast app-side bridge without waiting for DB normalization.

## Data Flow

    app/page.tsx / app/teams/[slug]/page.tsx
        -> lib/supabase/queries.ts (read-only fetch)
        -> lib/tournament/view-models.ts
             -> map textual colors to theme tokens
             -> build full-width layout + Info/roster/bracket VMs
        -> components/* render polished surfaces

Formation tooling remains separate:

    scripts/preview-formation.mjs / scripts/upload-formation.mjs
        -> local/operator workflow only
        -X-> no public app writes

## File Changes

| File | Action | Description |
|---|---|---|
| `app/page.tsx` | Modify | Replace capped landing shell with full-width desktop sections and bracket/grid framing. |
| `app/teams/[slug]/page.tsx` | Modify | Replace capped shell, remove duplicated profile metadata, and compose a single `Info` card plus standings/formation/fixtures sections. |
| `components/team/team-hero.tsx` | Modify | Replace thumbnail-style identity row with flag-dominant background hero and side crest treatment. |
| `components/team/team-info-card.tsx` | Create | Consolidated metadata card for title, federation, confederation, trophies/competition labels, and theme accents. |
| `components/team/team-roster-card.tsx` | Modify | Replace grouped decorative list with responsive listing/table rows and explicit unavailable state. |
| `components/tournament/bracket.tsx` | Modify | Replace `flex-wrap` presentation with explicit round-grid layout while keeping connector rendering metadata-driven. |
| `lib/tournament/view-models.ts` | Modify | Add `Info` and roster-row contracts; stop feeding stale duplicated hero metadata. |
| `lib/tournament/presentation.ts` | Modify | Add temporary textual color map and sanitized token output for hero/card accents. |

## Interfaces / Contracts

```ts
type TeamThemeToken = { accent: string; accentMuted: string; isNeutral: boolean };
type TeamInfoVm = { title: string; federation: string | null; confederation: string | null; trophies: string | null };
type TeamRosterRowVm = { name: string; position: string; age: number | null; club: string | null; number?: string | null; photoUrl?: string | null };
type TeamDetailVm = { hero: TeamHeroVm; info: TeamInfoVm; roster: { rows: TeamRosterRowVm[]; isEmpty: boolean } };
```

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit | Textual color mapping, roster-row shaping, Info-card fallback fields | Keep helpers pure; no runner exists yet |
| Integration | `/` and `/teams/[slug]` VM-to-component contracts under partial data | `pnpm build` plus manual DB-backed smoke checks |
| E2E | Full-width desktop layout, mobile reflow, bracket readability, team fallback states | Manual browser QA; no E2E runner exists |

## Migration / Rollout

No migration required. Next apply should replace four stale implementations: capped route shells, hero/profile metadata duplication, grouped roster list UI, and `flex-wrap` bracket layout. Keep Supabase access public read-only and keep formation authoring in local scripts only.

## Open Questions

- [ ] What is the initial canonical mapping set for the current textual `country.colors` values so the temporary theme map stays deterministic?
