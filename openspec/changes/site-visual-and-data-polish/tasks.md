# Tasks: Site Visual and Data Polish

## Review Workload Forecast

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

| Field | Value |
|-------|-------|
| Estimated changed lines | 560–590 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (color map + VM) → PR 2 (team page) → PR 3 (landing + bracket) |
| Delivery strategy | ask-always |
| Chain strategy | feature-branch-chain — resolved |

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Color mapping + VM contracts | PR 1 | Base: tracker branch |
| 2 | Team page visual corrections | PR 2 | Base: PR 1 branch; replaces hero/roster, adds Info card |
| 3 | Landing + Bracket grid | PR 3 | Base: PR 2 branch; full-width shell, bracket grid rebuild |

## Round 1 (completed)

All 22 original tasks verified complete in previous apply. See `verify-report.md`.

- [x] 1.1–1.5 Foundation (types, queries, VMs, palette, remotePatterns)
- [x] 2.1–2.5 Team page components (hero, roster, formation, fixtures, route)
- [x] 3.1–3.5 Landing enhancements (third-place ranking, bracket connectors, hero)
- [x] 4.1–4.7 Formation tooling (backfill, upload, preview, scripts)
- [x] 5.1–5.4 Verification (build, lint, 2 smoke pending)

## Round 2 — Corrective Layout/Composition

### Phase 6: Foundation — Color Map + VM Contracts

- [x] 6.1 Add `textToThemeToken()` in `lib/tournament/presentation.ts` — textual country.colors to hex tokens with neutral fallback
- [x] 6.2 Add `TeamInfoVm` and `TeamRosterRowVm` to `lib/tournament/view-models.ts`; update `buildTeamDetailVm()` to feed them
- [x] 6.3 Write test-ready pure functions for color mapping edge cases (unmappable text, null, empty)

### Phase 7: Team Page Visual Corrections

- [x] 7.1 ⚠️ Replace `app/teams/[slug]/page.tsx` — full-width shell, remove stale duplicated profile block, compose single Info card + sections
- [x] 7.2 ⚠️ Replace `components/team/team-hero.tsx` — flag-dominant background, lateral crest accent, no repeated metadata
- [x] 7.3 Create `components/team/team-info-card.tsx` — consolidated title/federation/confederation/trophies card with theme accent
- [x] 7.4 ⚠️ Replace `components/team/team-roster-card.tsx` — responsive table/listing rows with future-ready column slots, explicit empty state
- [x] 7.5 Write test-ready pure functions for Info-card fallback fields and roster-row shaping

### Phase 8: Landing + Bracket Grid

- [x] 8.1 Modify `app/page.tsx` — full-width shell with inner readable content wrappers
- [x] 8.2 ⚠️ Replace `components/tournament/bracket.tsx` — explicit round-grid layout replacing flex-wrap, metadata-driven connectors
- [x] 8.3 Write test-ready pure functions for bracket grid empty-state and connector degradation

### Phase 9: Verification

- [x] 9.1 `pnpm build` — zero type/import errors
- [x] 9.2 `pnpm lint` — zero lint regressions
- [ ] 9.3 Manual smoke: `/teams/[slug]` — full-width shell, flag hero bg, Info card, table roster
- [ ] 9.4 Manual smoke: `/` — full-width shell, bracket tournament-grid, responsive reflow
- [ ] 9.5 Manual smoke: partial-data fallback states on both pages

### Phase 10: Cleanup

- [x] 10.1 Remove stale profile metadata from page route and orphaned imports
- [x] 10.2 Update component JSDoc/contract comments to reflect new layout contracts

### Phase 11: Final UX Correction — Bracket Clarity + Roster Spacing

- [x] 11.1 Improve bracket progression clarity — replace flat `grid-cols-6` with flex+chevron layout, add round-chevrons between columns, add `border-b` round headers, bump card text to `text-sm`, increase `min-w` to 64rem
- [x] 11.2 Improve roster column width/spacing — widen grid from `[2.5rem_1fr_3rem_5rem_3rem]` to `[3rem_1fr_4.5rem_8rem_4rem]`, increase row padding and gap, widen team page content to `max-w-6xl`
- [x] 11.3 `pnpm build` — zero type/import errors
- [x] 11.4 `pnpm lint` — zero lint regressions

### Phase 12: Spec Refinement — Third Place Separation + Confederation Removal

- [x] 12.1 Separate Third Place match from the main winner-progression bracket — remove `third_place` from `BRACKET_ROUND_ORDER`, add `THIRD_PLACE_ROUND` constant, filter matches in Bracket component, render Third Place in a distinct surface below the main bracket with explicit "does not advance" disclaimer
- [x] 12.2 Remove Confederation field from Info card — remove `confederation` from `TeamInfoVm` type, `buildTeamInfoVm()`, `fillInfoFallbacks()`, and `team-info-card.tsx` rendering; update JSDoc comments
- [x] 12.3 `pnpm build` — zero type/import errors
- [x] 12.4 `pnpm lint` — zero lint regressions

### Phase 13: Formation Card Rendering Correction

- [x] 13.1 Extend team formation VM state to prefer validated `country.formation_json` metadata with backward-compatible SVG fallback from `country.formation`
- [x] 13.2 Render the published formation SVG inline on `/teams/[slug]`, keep the published badge, and preserve explicit unpublished / missing-graphic states
- [x] 13.3 Verify the formation render slice with targeted linting and project type-check/build validation

### Phase 14: Formation Text Authoring Labels + Slots

- [x] 14.1 Create a shared formation authoring parser that keeps legacy text rows and adds pipe-delimited `label` + optional `slot` support
- [x] 14.2 Reuse the shared parser in `scripts/upload-formation.mjs` and `scripts/preview-formation.mjs`, and surface the resolved label in the preview table
- [x] 14.3 Update concise authoring docs/examples and run targeted verification for legacy + extended text flows

### Phase 15: Formation Visual Polish

- [x] 15.1 Prefer app-rendered formation SVG from `country.formation_json` so team pages can refresh marker styling without waiting for stored SVG rewrites
- [x] 15.2 Apply team accent styling to formation player markers and switch player labels to a dark readable text treatment with safe fallback to stored SVG-only formations
- [x] 15.3 Update concise formation persistence docs and run targeted verification for the touched render path
