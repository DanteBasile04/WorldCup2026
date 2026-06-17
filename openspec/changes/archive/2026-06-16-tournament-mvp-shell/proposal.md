# Proposal: Tournament MVP Shell

## Intent

Deliver a public, read-only World Cup 2026 shell that makes the existing Supabase data useful now: a high-fidelity landing page, navigable group/team detail routes, and resilient rendering when knockout or team fields are incomplete.

## Scope

### In Scope
- Rework `/` to match the Stitch direction with editorial hero, premium dark styling, `Groups`/`Knockout` tabs, all-group standings cards, and a full Round-of-32-plus bracket.
- Upgrade `/groups/[slug]` to show standings plus matches grouped by jornada, with team links everywhere relevant.
- Upgrade `/teams/[slug]` to use populated country fields, theme UI from `colors`, show formation as in-progress, and exclude story.
- Normalize null-safe placeholders for incomplete Supabase values across landing, group, team, and knockout views.

### Out of Scope
- Auth, admin, CMS, live updates, or app-side editing.
- New Supabase content workflows, schema redesign, or story content expansion.

## Capabilities

### New Capabilities
- `tournament-landing`: Editorial landing shell with tabbed Groups/Knockout views and full-bracket visibility.
- `group-detail-pages`: Group detail pages with standings, jornada-based fixtures, and team navigation.
- `team-detail-pages`: Team detail pages using populated data fields, color-driven presentation, and visible formation status.
- `tournament-data-fallbacks`: Shared placeholder rules for incomplete matches, venues, teams, and status fields.

### Modified Capabilities
- None.

## Approach

Use App Router server components and Supabase read queries to compose page-specific view models, then move dense UI into reusable tournament components. Keep data read-only, prefer graceful placeholders over conditional page failure, and structure delivery so landing shell, data shaping, and detail pages can ship in reviewable slices.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `app/page.tsx` | Modified | Landing shell, tabs, groups overview, knockout bracket |
| `app/groups/[slug]/page.tsx` | Modified | Jornada grouping and richer group detail |
| `app/teams/[slug]/page.tsx` | Modified | Color-themed team profile and field selection |
| `lib/supabase/queries.ts` | Modified | Read models for groups, teams, knockout, and placeholders |
| `components/tournament/*` | New | Reusable bracket, cards, tables, and match blocks |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Incomplete knockout/team data causes broken UX | High | Define shared fallback copy and render partial states intentionally |
| UI + routing scope exceeds review budget | Med | Slice implementation by data layer, landing, then detail pages |

## Rollback Plan

Revert to the current simple read-only pages, remove new tournament components/query shaping, and keep Supabase unchanged since this change should not require schema mutations.

## Dependencies

- Existing Supabase tournament data quality
- Referenced Stitch direction for visual target

## Success Criteria

- [ ] `/` presents Groups and Knockout in one page with premium styling and usable placeholders.
- [ ] `/groups/[slug]` and `/teams/[slug]` are navigable from team/group links and render incomplete data safely.
- [ ] MVP remains public, read-only, and shippable without auth or live-update infrastructure.
