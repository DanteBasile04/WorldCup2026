# Tournament Landing Specification

## Purpose

Define the public read-only `/` shell for tournament discovery, navigation, and partial knockout visibility.

## Requirements

### Requirement: Public Read-Only Landing Shell

The system MUST expose `/` as a public read-only page and MUST NOT require auth or show editing, admin, live-update, or story-management controls.

#### Scenario: Anonymous visitor opens landing
- GIVEN a visitor requests `/`
- WHEN the page loads successfully
- THEN the page shows the tournament landing shell without authentication
- AND only read-only tournament content and navigation are presented

### Requirement: Groups and Knockout Tabs

The system MUST present Groups and Knockout views on `/`, with one active view visible at a time and switching tabs without changing the page contract.

#### Scenario: Visitor switches between tournament views
- GIVEN `/` is loaded
- WHEN the visitor selects the other tab
- THEN the matching Groups or Knockout view becomes active
- AND the page keeps the same landing context and navigation

### Requirement: Group Standings Card Overview

The system MUST show a standings card for every tournament group in the Groups view. Each card MUST identify the group, list its current standings in ranking order, and provide navigation to the corresponding group detail and team detail pages.

#### Scenario: Groups view renders all group cards
- GIVEN group standings data exists for multiple groups
- WHEN the Groups view is active
- THEN one standings card is rendered per group
- AND each card exposes links to its group page and listed teams

#### Scenario: Group data is partially incomplete
- GIVEN a group has missing standings fields or no rows yet
- WHEN its standings card is rendered
- THEN the card remains visible with null-safe placeholders
- AND other group cards continue rendering normally

### Requirement: Knockout Placeholder Visibility

The system MUST render the Round-of-32-and-beyond knockout structure in the Knockout view. When fixture, team, score, venue, or status data is incomplete, the system MUST show stable placeholders instead of hiding the bracket or failing the page.

#### Scenario: Knockout data is complete enough to render rounds
- GIVEN knockout round entries are available
- WHEN the Knockout view is active
- THEN the landing page shows the full bracket structure through the final
- AND each slot displays known values or placeholders for unknown values
