# Proposal: Site Visual and Data Polish

## Intent

Improve trust and scanability by surfacing verified Supabase data with explicit incomplete-data states instead of ambiguous placeholders. Priority slice 1 is `/teams/[slug]`: crest, flag, trophies, players, formation card, and fixtures must feel clearly team-specific while staying honest about missing inputs.

## Scope

### In Scope
- Slice 1: redesign `/teams/[slug]` to surface crest, flag, trophies, players, fixtures, and stronger per-team identity without hurting readability.
- Add a dedicated formation card plus roster/formation empty states based on current DB coverage instead of assuming new data will exist.
- Slice 2-4 on `/`: fuller visual hero, best-8-third-placed qualification treatment, and bracket readability improvements that work with current knockout data.

### Out of Scope
- New editorial/story content, auth/admin flows, broad app-wide re-theming, or formation SVG integration.
- Schema/data backfills for `country.formation`, missing `public.player` rows, or `match.next_match_id` population in this change.

## Capabilities

### New Capabilities
- None

### Modified Capabilities
- `team-detail-pages`: team pages must prioritize real identity and roster data, add a dedicated formation card, and define explicit empty states for missing roster/formation inputs.
- `tournament-landing`: landing must add a presentation hero, explicit best-third-place treatment, and clearer bracket relationships without inventing absent knockout links.
- `tournament-data-fallbacks`: new polish surfaces must keep a deliberate incomplete-data contract instead of silent placeholders.

## Approach

Use verified live coverage as the constraint: `flag_url`/`emblem_url` 48/48, `trophies` 32/48, `player` rows for 47/48 teams, `formation` 0/48, `next_match_id` 0/104. Consume populated fields now; ship explicit unavailable states for formation and missing rosters; improve bracket readability with current round data and only add advancement connectors if mapping can be derived safely.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `app/teams/[slug]/page.tsx` | Modified | Priority slice 1 team-page layout and data surfacing |
| `lib/supabase/queries.ts` | Modified | Expand team-page and landing data retrieval |
| `lib/tournament/view-models.ts` | Modified | Carry roster, formation-state, ranking, and bracket-display metadata |
| `app/page.tsx`, `components/tournament/*` | Modified | Hero, third-place treatment, and bracket readability/connector behavior |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| `country.formation` is empty for all teams | High | Treat as a confirmed input gap, not a blocker: ship the card with explicit “not published yet” copy and no SVG/schema promise in this slice |
| One team lacks `public.player` rows | Med | Render roster from current data for 47 teams and show a team-page empty state when no rows exist |
| `match.next_match_id` is unpopulated | High | Do not base the landing slice on absent links; use round-based bracket polish and add connectors only if a deterministic mapping can be derived safely |

## Rollback Plan

Revert team/landing UI and related query/view-model changes to the current fallback-safe cards while preserving the existing page routes and null-safe rendering contract.

## Dependencies

- Confirm the Stitch formation-card pattern to mirror.
- Verify any connector mapping from current knockout rounds before specs/apply; otherwise keep bracket polish unlinked.

## Success Criteria

- [ ] Team page ships first and surfaces crest, flag, trophies, roster, formation card, and fixtures using current DB data, with explicit roster/formation empty states when data is absent.
- [ ] Landing adds hero, best-third-place treatment, and clearer bracket readability without inventing knockout links or regressing null-safe rendering.
