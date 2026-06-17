# Design: Tournament MVP Shell

## Technical Approach

Keep the current App Router + server-component architecture, but treat the Stitch project's `designMd` as a formal visual-system spec that drives implementation tokens, component states, and readability rules. Supabase reads stay in `lib/supabase/queries.ts`; `lib/tournament/view-models.ts` and `lib/tournament/presentation.ts` translate raw rows plus visual-system rules into render-safe view models for landing, group, team, and knockout surfaces.

## Architecture Decisions

| Decision | Options | Choice / Rationale |
|---|---|---|
| Visual source of truth | Use Stitch only as inspiration; codify tokens/helpers | Codify `designMd` into app-level theme tokens and presentation helpers. This makes dark premium shell, crimson/gold accents, type roles, glass overlays, and density rules testable instead of subjective. |
| Fonts + typography roles | Keep Geist; swap ad hoc per component; central role mapping | Update `app/layout.tsx`/`app/globals.css` to load Montserrat for headlines, Plus Jakarta Sans for body/UI, and JetBrains Mono for scores/data labels. Shared roles avoid drift across cards, tabs, tables, and bracket nodes. |
| Tabs + swappable panels | Client tabs; separate routes; query-string tabs | Keep `/` with `?view=groups|knockout` and server-rendered links. Active state gets gold underline/high-emphasis styling from the visual system without adding a client island. |
| Team colors vs brand system | Let `country.colors` fully theme pages; ignore team colors; sanitize accents only | Global shell stays obsidian + crimson/gold. Team `colors` may tint secondary chips, borders, badges, or hero accents only after contrast checks and whitelist parsing; tables, scores, tabs, and primary CTAs stay on brand to protect readability. |
| Dense tournament data surfaces | Spacious editorial cards everywhere; raw compact tables/brackets | Use compact data components with mono labels, zebra striping, qualification bars, winner-gold emphasis, and subdued loser states. This matches the high-contrast tournament brief without breaking scanability. |

## Data Flow

`designMd rules + app tokens`
`        │`
`page/group/team routes -> lib/supabase/queries.ts`
`        -> lib/tournament/view-models.ts`
`        -> lib/tournament/presentation.ts`
`        -> components/tournament/* + components/ui/section-card.tsx`

Visual rules enter before render: surfaces map to obsidian/glass variants, spacing resolves to a fixed rhythm, and missing values still use shared placeholders (`TBD team`, `Score TBD`, `Venue TBD`, `Status TBD`).

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `app/layout.tsx` | Modify | Replace Geist-only setup with Stitch typography imports and root font variables. |
| `app/globals.css` | Modify | Add shell tokens for obsidian surfaces, crimson/gold accents, spacing rhythm, blur utilities, and soft-rounding defaults. |
| `app/page.tsx` | Modify | Read `searchParams`, apply premium landing shell, and compose Groups/Knockout panels from view models. |
| `app/groups/[slug]/page.tsx` | Modify | Consume grouped standings/fixtures view model with dense table styling, zebra rows, and qualification emphasis. |
| `app/teams/[slug]/page.tsx` | Modify | Use branded shell plus contrast-safe team accent treatment, populated facts, and formation status. |
| `lib/supabase/queries.ts` | Modify | Add landing + knockout reads and shared hydration entry points. |
| `lib/tournament/view-models.ts` | Create | Convert raw rows into landing/group/team/bracket view models, including winner/loser emphasis and qualification markers. |
| `lib/tournament/presentation.ts` | Create | Shared fallback labels, score/status formatting, spacing/density flags, and safe team-color parsing. |
| `components/ui/section-card.tsx` | Modify | Align reusable section surface with premium dark/glass rules. |
| `components/tournament/*` | Create | Tabs, standings cards/table, match cards, bracket, and team hero using shared visual contracts. |

## Interfaces / Contracts

```ts
type TournamentTheme = {
  surface: "obsidian" | "glass";
  accent: "crimson" | "gold";
  radius: "soft";
  density: "comfortable" | "compact";
};
type TeamPalette = { accent: string; accentMuted: string; useOn: "badge" | "border" | "hero"; isNeutral: boolean };
type StandingRowVm = { teamName: string; teamSlug: string | null; zone: "qualified" | "playoff" | "none" };
type BracketMatchVm = MatchCardVm & { winnerSide: "home" | "away" | null };
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | Color sanitization, score/status formatting, winner/qualification flags, density helpers | No runner installed; keep helpers pure and manually exercise representative inputs during implementation. |
| Integration | Route query + view-model + branded component composition | Manual verification in dev for `/`, `/groups/[slug]`, `/teams/[slug]`, partial data, and missing env state. |
| E2E | Tab swaps, readable tables/brackets, placeholder consistency | Manual browser checks across dark shell states, active tab underline, and team-color edge cases. |

## Migration / Rollout

No migration required. Preserve review slices: (1) typography/theme tokens + presentation helpers, (2) landing shell + tabs + bracket skeleton, (3) group detail density/table polish, (4) team detail + safe team-color accents. This keeps PR boundaries explicit and aligned with the 400-line review budget.

## Open Questions

- [ ] `match.round` still lacks `round_of_32`, while the landing spec requires full Round-of-32 visibility. Confirm whether MVP ships with a UI skeleton plus placeholders until backend data catches up.
