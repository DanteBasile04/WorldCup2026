# Team Detail Pages Specification

## Purpose

Define `/teams/[slug]` as the read-only team profile built from populated country data.

## Requirements

### Requirement: Team Detail Routing

The system MUST resolve `/teams/[slug]` for known teams and MUST provide a safe unavailable outcome for unknown teams.

#### Scenario: Visitor opens an existing team page
- GIVEN a valid team slug exists
- WHEN the visitor requests `/teams/[slug]`
- THEN the page shows that team's profile
- AND the page uses tournament data for the selected team only

### Requirement: Populated Field Presentation

The system MUST prefer populated country fields for the team profile and SHOULD omit unsupported story content rather than inventing it.

#### Scenario: Team has several populated profile fields
- GIVEN a team has populated descriptive and tournament fields
- WHEN the profile renders
- THEN the page shows the available values in the team presentation
- AND missing optional fields do not block the rest of the profile

### Requirement: Color-Driven Theming

The system MUST use the team's stored color information when available and MUST fall back to a safe neutral presentation when those values are absent or unusable.

#### Scenario: Team colors are incomplete
- GIVEN a team record lacks valid color values
- WHEN the team page renders
- THEN the page uses a safe default visual treatment
- AND text and navigation remain readable

### Requirement: Formation Status Visibility

The system MUST show formation as an in-progress or unavailable status when no ready formation experience is supported by current data.

#### Scenario: Formation is not ready for public display
- GIVEN the current team data does not support a finished formation experience
- WHEN the formation area renders
- THEN the page communicates that formation is in progress or unavailable
- AND the rest of the team profile remains usable
