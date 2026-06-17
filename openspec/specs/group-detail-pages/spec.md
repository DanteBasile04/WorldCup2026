# Group Detail Pages Specification

## Purpose

Define `/groups/[slug]` as the detailed read-only view for a single group.

## Requirements

### Requirement: Group Detail Routing

The system MUST resolve `/groups/[slug]` for known groups and MUST provide a non-broken user outcome for unknown or unavailable groups.

#### Scenario: Visitor opens an existing group page
- GIVEN a valid group slug exists
- WHEN the visitor requests `/groups/[slug]`
- THEN the page shows that group's read-only detail view
- AND the page includes standings and fixture content for the same group

#### Scenario: Visitor opens an unknown group page
- GIVEN the requested group slug has no matching group
- WHEN the visitor requests `/groups/[slug]`
- THEN the system shows a safe not-found or unavailable outcome
- AND the app does not render unrelated group data as a substitute

### Requirement: Group Standings Detail

The system MUST show the selected group's standings in ranking order and MUST preserve team navigation from each standings row.

#### Scenario: Standings table links to teams
- GIVEN a group page has standings rows
- WHEN the standings area is rendered
- THEN each row shows the team's current standing information
- AND each team row links to `/teams/[slug]` for that team

### Requirement: Jornada-Based Match Grouping

The system MUST group group-stage fixtures by jornada on `/groups/[slug]` and MUST keep each match associated with its jornada label.

#### Scenario: Group fixtures are organized by jornada
- GIVEN group-stage matches exist across multiple jornadas
- WHEN the group page renders its fixtures
- THEN matches are displayed under their corresponding jornada groups
- AND the jornadas are distinguishable to the visitor

### Requirement: Match Navigation and Partial Data Safety

The system MUST link each referenced team in group fixtures to its team detail page and MUST render placeholder values when match metadata is incomplete.

#### Scenario: Group fixture has incomplete metadata
- GIVEN a group match is missing score, venue, or status values
- WHEN the fixture list renders
- THEN the match remains visible with placeholder values
- AND team navigation still works for the known sides
