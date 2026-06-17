# Delta for tournament-landing

## ADDED Requirements

### Requirement: Presentation Hero

The system MUST present the landing hero and other primary landing surfaces at full viewport width on desktop and MUST keep them responsive on smaller viewports. The system MUST preserve legibility of headline and summary content.

#### Scenario: Hero assets are available
- GIVEN hero visuals are configured
- WHEN `/` renders
- THEN the landing page shows a presentation-first hero
- AND the overlay content remains readable

#### Scenario: Hero visuals are incomplete
- GIVEN a hero visual source is unavailable
- WHEN `/` renders
- THEN the hero still shows the landing headline and summary
- AND the rest of the landing page remains intact

### Requirement: Best Third-Place Qualification Treatment

The system MUST explain the best-8-third-place advancement rule in the Groups view and SHOULD identify current third-place ranking outcomes when standings data supports them.

#### Scenario: Third-place comparison is available
- GIVEN group standings include third-place rows across groups
- WHEN the Groups view renders
- THEN the landing page shows which third-place teams are currently advancing
- AND the treatment explains the qualification basis

#### Scenario: Third-place comparison is incomplete
- GIVEN standings are too incomplete for a stable ranking
- WHEN the Groups view renders
- THEN the landing page shows the rule without inventing advancement outcomes

## MODIFIED Requirements

### Requirement: Knockout Placeholder Visibility

The system MUST render the Round-of-32-and-beyond winner-progression knockout structure in the Knockout view as an explicit tournament-grid bracket rather than compact cards with loose indicators, MUST keep the full winner-progression bracket viewable without clipped rounds or inaccessible matches, and SHOULD make round progression visually clearer from one match to the next even when deterministic advancement links are unavailable. When a Third Place match exists in the knockout data, the system MUST present it as a separate surface from the main winner-progression bracket flow and MUST NOT imply that it advances toward the final. When fixture, team, score, venue, status, or advancement-link data is incomplete, the system MUST show stable placeholders instead of inventing links, hiding the bracket, or failing the page.
(Previously: The bracket only needed to show the full knockout structure with known values or placeholders, without requiring a fully viewable tournament-grid presentation, separate Third Place treatment, or stronger progression cues.)

#### Scenario: Knockout data is complete enough to render rounds
- GIVEN knockout round entries are available
- WHEN the Knockout view is active
- THEN the landing page shows the full bracket structure through the final in a grid-style tournament layout
- AND known round relationships are visually clearer than a card-column presentation

#### Scenario: Bracket width exceeds the viewport
- GIVEN the full knockout bracket is wider than the current viewport
- WHEN the Knockout view renders
- THEN every round and match remains accessible within the bracket experience
- AND no portion of the bracket is silently clipped or hidden

#### Scenario: Third Place match is available
- GIVEN knockout data includes a Third Place match
- WHEN the Knockout view renders
- THEN that match appears in a separate surface from the winner-progression bracket
- AND the presentation does not imply advancement into the final path

#### Scenario: Advancement links are unavailable
- GIVEN knockout matches exist but advancement mapping is missing or unsafe
- WHEN the Knockout view renders
- THEN the bracket remains visible without invented connectors
- AND unresolved relationships still communicate directional progression through bracket layout and the incomplete-data contract
