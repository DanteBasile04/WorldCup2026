# Delta for team-detail-pages

## ADDED Requirements

### Requirement: Roster Presentation

The system MUST show a roster section on `/teams/[slug]` as a structured listing surface with readable column spacing for supported player fields, SHOULD leave enough horizontal and vertical breathing room for future roster fields, and MUST keep the section honest when rows are missing.

#### Scenario: Team roster data is available
- GIVEN a team has player rows
- WHEN the team page renders
- THEN the page shows player entries for that team only
- AND each supported player field remains readable as a scan-friendly listing rather than a cramped decorative tile layout

#### Scenario: Roster rows have several populated fields
- GIVEN roster rows contain multiple supported player fields
- WHEN the roster section renders
- THEN those fields appear with enough separation that each value can be read independently
- AND the listing still leaves room for future roster-field expansion without collapsing the current layout

#### Scenario: Team roster data is missing
- GIVEN a team has no player rows
- WHEN the team page renders
- THEN the roster section stays visible with an explicit unavailable state
- AND the rest of the team page remains usable

### Requirement: Fixture Persistence

The system MUST keep the fixture section visible whenever team matches are known and MUST preserve known match metadata even when adjacent values are incomplete.

#### Scenario: Fixtures are available
- GIVEN a team has scheduled or completed matches
- WHEN the fixture list renders
- THEN the page shows those fixtures in team context
- AND the fixture section remains visible as a first-class card

#### Scenario: Fixtures have partial match data
- GIVEN a team fixture has a known opponent or date but other fields are missing
- WHEN the fixture list renders
- THEN the known values remain visible and in team context
- AND missing values use the shared incomplete-data contract

## MODIFIED Requirements

### Requirement: Populated Field Presentation

The system MUST present `/teams/[slug]` on full-width primary surfaces on desktop and MUST reflow responsively on smaller viewports. The system MUST prefer populated country and roster fields for the team profile, including crest, flag, trophies, federation, players, formation, and fixtures. The hero MUST use the national flag as its primary background treatment, SHOULD place the crest or emblem as a side accent when available, and MUST keep team title, federation, and competition or trophy names in a single Info card instead of duplicating them in the hero or adding a redundant confederation field. The system SHOULD omit unsupported editorial content rather than inventing it.
(Previously: The page generically preferred populated country fields without requiring full-width layout, flag-led hero treatment, or a consolidated Info card, and the current delta still listed confederation inside that card.)

#### Scenario: Team has populated identity and profile fields
- GIVEN a team has flag, crest or emblem, federation, and trophy data
- WHEN the profile renders
- THEN the hero uses the flag as the main background and the crest or emblem as a side accent
- AND a single Info card carries the team title, federation, and competition or trophy names

#### Scenario: Team has partial identity data
- GIVEN one or more identity or profile fields are missing
- WHEN the profile renders
- THEN the available values still render in the hero or Info card without duplicate headings
- AND the responsive full-width layout remains usable without a confederation row

### Requirement: Color-Driven Theming

The system MUST translate textual `country.colors` values through a temporary application mapping into usable theme tokens for team-page differentiation and MUST fall back to a safe neutral presentation when those values are absent or unmappable. The system MUST preserve text, card, and navigation readability over brand expression.
(Previously: Team colors only needed to apply directly when available with a neutral fallback.)

#### Scenario: Team colors support branded presentation
- GIVEN a team record has mappable textual color values
- WHEN the team page renders
- THEN team-specific accents appear across the hero, Info card, and supporting sections
- AND readable contrast is preserved

#### Scenario: Team colors are incomplete
- GIVEN a team record lacks mappable color values
- WHEN the team page renders
- THEN the page uses a safe default visual treatment
- AND text and navigation remain readable

### Requirement: Formation Status Visibility

The system MUST present formation in a dedicated card on `/teams/[slug]` and MUST show either the current formation value or an explicit unavailable state when no publishable formation is present.
(Previously: Formation only needed to show as in-progress or unavailable when no finished experience existed.)

#### Scenario: Formation value is available
- GIVEN a team has a formation value
- WHEN the formation area renders
- THEN the page shows that value in a dedicated formation card
- AND the card follows the approved formation presentation pattern

#### Scenario: Formation is not ready for public display
- GIVEN the team has no publishable formation value
- WHEN the formation area renders
- THEN the page communicates that formation is not published yet
- AND the rest of the team profile remains usable
