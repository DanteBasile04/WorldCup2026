# Exploration: Site Visual and Data Polish

## Current State

The `tournament-mvp-shell` change delivered a functional public read-only tournament hub at `/`, `/groups/[slug]`, and `/teams/[slug]`. The shell uses a premium dark theme (obsidian surfaces, crimson/gold accents, Montserrat headlines, Plus Jakarta Sans body, JetBrains Mono for data), server-rendered query-string tabs (`?view=groups|knockout`), and resilient placeholders for incomplete Supabase data.

However, four user-facing gaps remain:

1. **Hero area** — Static text-only section with stat counters. No imagery, no full-width presentation feel, no human appeal beyond typography.
2. **Third-place qualification** — The 48-team format uses "best 8 third-placed teams advance" but the current `qualificationZone()` logic (rank ≤ 2 → qualified, rank ≤ 4 → playoff) is a stub that neither computes nor displays the real rule.
3. **Knockout bracket** — Columnar layout with independent match cards per round. No connector lines, no visual pairing of "winner of match X vs winner of match Y", no tree visualization. The `match.next_match_id` column exists in the database but is unused.
4. **Team pages** — The `TeamDetailVm` carries `flagUrl` and `emblemUrl` but neither is rendered. Player data is absent from the database (no `player` table). Formation is displayed as a text string with "In progress" badge; the SVG generator exists as a script but is not integrated. Team colors only tint a thin hero accent bar and border — the rest of the page has no per-team differentiation.

## Affected Areas

### Theme 1 — Hero Area
- `app/page.tsx` (L35-78) — current hero section: text headline, subtitle, 3 stat counters in `glass-strong` surface
- `app/globals.css` (L1-72) — theme tokens: `--radius-hero`, `.glass-strong`, spacing variables. No image/background utilities defined.
- `components/ui/section-card.tsx` — reusable section surface (obsidian/glass variants); not consumed by the hero
- `next.config.ts` — no `images.remotePatterns` configured; Supabase-hosted flag/emblem URLs from Wikipedia would need `remotePatterns` for `next/image`

### Theme 2 — Best Third-Placed Teams
- `lib/tournament/view-models.ts` (L106-111) — `qualificationZone()` function: hardcoded rank ≤ 2 → qualified, rank ≤ 4 → playoff
- `lib/supabase/queries.ts` (L228-287) — `getLandingData()`: fetches all standings but does not cross-compare third-place rows
- `lib/supabase/database.types.ts` — `GroupStanding` type: per-group only, no cross-group ranking column
- `components/tournament/standings-card.tsx` — renders zone bar (qualified/playoff) based on VM zone field
- `app/page.tsx` — landing page renders group cards as-is; no third-place ranking section
- No dedicated table/view for best-third-team ranking exists in the database schema

### Theme 3 — Knockout Bracket
- `components/tournament/bracket.tsx` (L1-188) — columnar layout by round, independent `BracketMatch` components, `PlaceholderSlot` for empty rounds
- `lib/tournament/view-models.ts` (L55-57) — `BracketMatchVm` extends `MatchCardVm` with `winnerSide`; no `advancesTo` or connector metadata
- `lib/supabase/database.types.ts` (L46) — `match.next_match_id: number | null` — EXISTS in schema and type but NEVER CONSUMED by queries or view models
- `lib/supabase/queries.ts` (L244-249) — `getLandingData()` fetches knockout matches but does not resolve `next_match_id` links
- No SVG/Canvas connector lines exist; bracket is purely CSS-flex layout

### Theme 4 — Team Pages
- `app/teams/[slug]/page.tsx` (L1-221) — current team page implementation
- `lib/tournament/view-models.ts` (L77-88) — `TeamDetailVm` carries `flagUrl`, `emblemUrl`, `palette` but no player data
- `lib/tournament/presentation.ts` (L56-166) — `parseTeamColors()` returns `TeamPalette` with `useOn` field (currently always `"badge"`); contrast-safe hex parsing
- `lib/supabase/database.types.ts` (L15-26) — `Country` type: `flag_url`, `emblem_url`, `colors`, `formation` (string), NO player-related columns or table
- `scripts/generate-formation-svg.mjs` — exists as CLI script; can produce SVG from formation JSON; NOT integrated into the app
- `scripts/export-fbref-players.mjs` — exists as CLI scraper; outputs player JSON/CSV to `generated/`; NOT imported into Supabase
- `samples/formation-mexico-input.json` — example formation+player data for one team
- `public/` — empty; no local flag/emblem assets
- `next.config.ts` — no `images.remotePatterns` for external image URLs
- `app/globals.css` — theme tokens are static CSS custom properties; no per-team color variable override mechanism

## Approaches

### Theme 1 — Hero Area

#### Approach A: Add curated background image + enhanced typography
Use a high-quality World Cup 2026 promotional image as a hero background (CSS `background-image` with overlay), enhance the typography hierarchy, and add subtle animated elements (CSS-only, no JS).
- **Pros**: High visual impact, low implementation effort, no new dependencies, works with server components
- **Cons**: Requires finding/acquiring a suitable image (license), static image may not update, needs responsive variants
- **Effort**: Low-Medium

#### Approach B: Build dynamic hero with team flag mosaic/grid
Render a dynamic mosaic/grid of team flags (from `country.flag_url` Supabase data) as the hero background pattern, overlaid with the existing glass text block. This showcases real tournament data and creates immediate connection to the teams.
- **Pros**: Data-driven, automatically updates as teams qualify, no external image licensing, showcases the data we have
- **Cons**: ~48 flag images to load (performance), needs `next/image` remotePatterns config, requires careful overlay contrast
- **Effort**: Medium

**Recommendation**: Start with Approach B (flag mosaic) as it's data-driven and requires no external assets. Fall back to Approach A if performance is an issue. Both can coexist — mosaic as background pattern, glass overlay for text readability.

### Theme 2 — Best Third-Placed Teams

#### Approach A: Dedicated "Best Third-Placed Ranking" table on landing page
Add a new section below the group cards (in Groups view) that computes and displays a cross-group ranking of third-placed teams, highlighting the top 8 that advance. This is a separate table component with its own sorting logic.
- **Pros**: Clear, unambiguous UX — users see exactly which third-placed teams qualify; computation is pure client-side (or server-side) from existing data; no database changes needed
- **Cons**: Adds a new UI section that may be empty before group stage completes; duplicates some standings data; users must scroll to find it
- **Effort**: Low-Medium

#### Approach B: Integrated treatment — modify zone indicators in group cards
Change the `qualificationZone()` logic to mark third-place rows as "pending" or "qualified (best third)" after computing the cross-group ranking. Add a visual indicator (e.g., dashed zone bar, "Best 3rd" badge) to the group standings cards and group detail pages.
- **Pros**: No new UI section needed; information lives where users already look; leverages existing zone bar pattern
- **Cons**: Requires cross-group computation to be available at card render time (server-side in `buildLandingVm`); less explicit about which third-placed teams are eliminated; might be confusing without explanation
- **Effort**: Medium

**Recommendation**: **Combined approach** — use Approach B for integrated zone indicators (show qualification status per row) AND add a compact "Third-Place Ranking" summary section below the group grid. This gives users both at-a-glance group context and the explicit ranking they need. The computation can happen in `buildLandingVm` since we already fetch all standings.

### Theme 3 — Knockout Bracket Visualization

#### Approach A: SVG connector lines between round columns
Keep the current columnar layout but add SVG `<line>` elements (or simple CSS borders/pseudo-elements) that connect advancing teams from one round to their corresponding slot in the next round, using `match.next_match_id` to resolve connections. Teams advance from match to next match slot.
- **Pros**: Builds on existing layout, no complete rewrite; `next_match_id` already exists; connectors dramatically improve readability; pure CSS/SVG, no library needed
- **Cons**: Requires computing match tree from `next_match_id` links; connector layout is fragile with varying match card heights; needs careful alignment
- **Effort**: Medium

#### Approach B: Full tournament tree layout (bracket-style)
Replace the columnar layout with a proper tournament bracket tree (like ESPN/Google's bracket views), where matches are arranged as a binary tree with connector lines forming the classic bracket shape. This could use a lightweight library like `react-tournament-bracket` or be custom-built.
- **Pros**: Industry-standard bracket UX; immediately recognizable; handles all edge cases (byes, TBDs) naturally
- **Cons**: Much higher implementation effort; would require a significant rewrite of `bracket.tsx`; libraries add bundle weight; may not align with current dark/glass theme without customization
- **Effort**: High

**Recommendation**: Approach A (SVG/CSS connectors on existing columnar layout). It's the pragmatic choice — builds on existing code, uses data we already have (`next_match_id`), delivers 80% of the UX improvement for 30% of the effort. Can be done with pure CSS/SVG in a server component. If later we need a full ESPN-style bracket, we can evaluate then.

### Theme 4 — Team Page Enhancements

#### Flag/Emblem Rendering
- **Approach**: Add `<Image>` (next/image) components for `flagUrl` and `emblemUrl` in the team hero and profile card. Requires `images.remotePatterns` in `next.config.ts` for Wikipedia domains.
- **Effort**: Low (data already available, just not rendered)

#### Formation Card
- **Approach**: Extract formation from the current "Profile" card into its own dedicated card. If `country.formation` has a value, render it prominently with a visual layout (formation string + player positions diagram). The existing `generate-formation-svg.mjs` script can be adapted to run at build time or serve pre-generated SVGs. For the immediate polish pass, display the formation string prominently in its own card with enhanced styling; integrate SVG generation in a follow-up change.
- **Effort**: Medium (own card + styling = low; SVG integration = medium-high)

#### Player Data
- **Finding**: Player data does NOT exist in the current Supabase database. The `Country` type has no player array. The `scripts/export-fbref-players.mjs` exports player data as JSON/CSV files but there is no `player` table in `database.types.ts`. Adding player display would require: (1) creating a `player` table in Supabase, (2) importing player data via the existing scraper, (3) adding a `getTeamPlayers` query, (4) building the UI. This is a significant data-layer change.
- **Recommendation**: Defer player data to a follow-up change. The current change should focus on rendering existing data (flags, emblems, formation as own card).

#### Team Color-Driven UI Differentiation
- **Approach**: Evaluate whether to use a library or native implementation.

| Consideration | Native (CSS Custom Properties) | Library (e.g., next-themes, color-scheme) |
|---|---|---|
| What it solves | Per-team accent coloring via inline `style` props | Theme switching (dark/light mode), not per-entity coloring |
| Fit | `parseTeamColors()` already returns hex + muted rgba; apply to card backgrounds, borders, accent bars, and badge colors per team | `next-themes` controls a single app-level theme; irrelevant for per-team colors |
| Bundle impact | Zero | Adds dependency; does NOT help with per-team coloring |
| Complexity | Low — extend current `style={{ borderColor: accentMuted }}` pattern to more elements | Medium — solves a different problem |
| Tailwind v4 compat | Full — CSS custom properties work natively with `@theme inline` | Compatible but orthogonal |

- **Recommendation**: **Native CSS custom properties only. No library is justified.** Tailwind v4's CSS-first configuration already supports the pattern we need. The current `parseTeamColors()` + inline `style` props approach is correct and just needs to be applied more broadly. For the team page, we should:
  - Use `palette.accent` for: hero top bar (already done), section headers underline, fixture win indicators, card accent borders
  - Use `palette.accentMuted` for: card backgrounds (`backgroundColor: accentMuted` on profile/position cards), subtle hover states
  - Keep global shell (background, nav, tabs, footer) in obsidian/crimson theme — do NOT recolor the entire page per team (accessibility risk)
  - The `TeamPalette.useOn` field can be extended to `"badge" | "border" | "hero" | "card"` to signal where each color is approved

## Data Availability Summary

| Data Field | In DB? | In TypeScript Type? | Rendered on Page? | Notes |
|---|---|---|---|---|
| `flag_url` | Yes (Supabase `country`) | Yes (`Country.flag_url`) | **NO** — available but not rendered | Needs `next/image` remotePatterns for Wikipedia |
| `emblem_url` | Yes (Supabase `country`) | Yes (`Country.emblem_url`) | **NO** — available but not rendered | Same as flag_url |
| `colors` | Yes (Supabase `country`) | Yes (`Country.colors`) | Partially — only hero accent bar | `parseTeamColors()` works; needs broader application |
| `formation` | Yes (Supabase `country`) | Yes (`Country.formation`, string) | Minimally — text with "In progress" badge | SVG generator script exists but not integrated |
| Player data | **NO** — no `player` table | **NO** | **NO** | `export-fbref-players.mjs` scraper exists; would need schema + import + query + UI |
| `next_match_id` | Yes (Supabase `match`) | Yes (`Match.next_match_id`) | **NO** — never consumed | Key for bracket connectors |
| Third-place ranking | **NO** — no table/view | **NO** | **NO** | Can be computed client/server-side from existing standings |
| Flag/emblem local assets | **NO** — `public/` is empty | N/A | N/A | All flags/emblems are remote URLs in Supabase |

## Recommendation

**Recommended approach per theme** (ordered by implementation priority):

1. **Team pages** (highest impact, most unmet user expectation): Render flag/emblem images, extract formation into its own card, broaden team-color application to cards/borders. Defer player data and SVG formation to follow-up changes.

2. **Hero area**: Flag mosaic background with glass overlay text — data-driven, no external assets needed, showcases tournament data.

3. **Knockout bracket**: CSS/SVG connector lines between round columns using `match.next_match_id` to resolve match tree links.

4. **Best third-placed teams**: Combined approach — update zone indicators in group cards + add compact "Third-Place Ranking" summary below group grid.

**Library recommendation**: No new dependencies are justified. Native CSS custom properties + Tailwind v4 + inline styles cover all color theming needs. The bracket connectors can use CSS borders/pseudo-elements or inline SVG. No React library solves the per-team coloring problem — that's a CSS architecture concern.

## Risks

- **Image loading performance**: ~48 flag images in a mosaic hero could cause layout shift and slow LCP. Mitigation: use `next/image` with `priority` for above-fold, `loading="lazy"` for below-fold, and appropriate `sizes` attributes. Configure `remotePatterns` for Wikipedia/Supabase storage domains.
- **`next_match_id` data quality**: The column exists but may not be populated for all matches. Mitigation: design bracket connectors to gracefully degrade — if `next_match_id` is null, show a placeholder slot instead of a broken connector.
- **Third-place ranking computation**: Cross-group ranking by points/GD/GF must match FIFA tiebreaker rules. Mitigation: document the tiebreaker order, implement as a pure function with unit-testable logic, and clearly label it as "unofficial projection" until group stage completes.
- **Team color contrast**: Applying team accent colors to card backgrounds risks readability if the color is too bright or too dark. Mitigation: `parseTeamColors()` already enforces minimum contrast ratio against obsidian background. Extend the `useOn` field to gate which surfaces accept team colors.
- **Scope creep**: Player data and formation SVG integration are significant work items. Mitigation: explicitly defer these to follow-up changes and keep this change focused on rendering already-available data.

## Ready for Proposal

**Yes.** All four themes have been investigated, approaches compared, data availability verified, and risks identified. The orchestrator can proceed to `sdd-propose` with the following framing:

- This is a visual-and-data polish change, NOT a data-layer expansion. Player data and formation SVG generation are deferred.
- No new dependencies are required — all improvements use existing tech stack (Next.js, Tailwind v4, CSS custom properties, inline SVG).
- The change touches 7-10 existing files and may add 1-2 new components (third-place ranking table, flag mosaic component).
- Estimated scope: 400-700 changed lines across 4 slices (team pages, hero, bracket, third-place).
