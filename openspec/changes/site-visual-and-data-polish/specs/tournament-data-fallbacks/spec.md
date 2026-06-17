# Delta for tournament-data-fallbacks

## ADDED Requirements

### Requirement: Explicit Incomplete-Data Disclosure

The system MUST prefer explicit unavailable states over ambiguous placeholders when a polished surface depends on data that is partially missing.

#### Scenario: Polished section has all required data
- GIVEN a team or landing section has the data it needs
- WHEN the section renders
- THEN the polished content is shown directly
- AND no unavailable copy is introduced

#### Scenario: Polished section lacks one required dataset
- GIVEN a team or landing section is designed to show richer data
- WHEN one required dataset is missing
- THEN the section states that the data is unavailable or not published yet
- AND surrounding known data remains visible

## MODIFIED Requirements

### Requirement: Stable Placeholder Contract

The system MUST render stable placeholders or explicit unavailable states for incomplete team names, match scores, venues, status values, roster rows, formation values, bracket relationships, and other user-visible tournament fields instead of throwing, hiding the surrounding section, or mixing in unrelated data.
(Previously: The contract covered general tournament fields without calling out roster, formation, or bracket-relationship gaps.)

#### Scenario: A page receives partial tournament records
- GIVEN a page view model contains null or missing user-visible fields
- WHEN the affected section renders
- THEN placeholders or explicit unavailable states are shown for the missing values
- AND the rest of the section remains visible and internally consistent

### Requirement: Cross-Page Consistency

The system SHOULD apply the same incomplete-data meanings across landing, group, team, and knockout surfaces so missing roster, fixture, and identity data is recognizable and testable in every view.
(Previously: Equivalent missing fields only needed consistent semantic fallback behavior across page types.)

#### Scenario: The same missing field appears on different pages
- GIVEN equivalent tournament fields are missing in multiple page types
- WHEN those pages render
- THEN each page uses the same semantic fallback behavior
- AND verification can assert a consistent incomplete-data contract
