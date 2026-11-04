## ADDED Requirements

### Requirement: The lexical ranking is diagnosed
The project SHALL record, from a reproducible analysis, where the full-text and vector rankings place the expected unit of each answerable question and what outranks it, and the documentation SHALL state the findings and SHALL NOT state an unmeasured cause as fact.

#### Scenario: Reader asks why full-text underperforms
- **WHEN** a reader checks the documentation for the cause
- **THEN** it cites the analysis output, and any explanation not confirmed by it is marked as a hypothesis

### Requirement: Lexical ranking options are explicit
Any lexical ranking other than the default full-text ranking SHALL be an explicit, documented search option, and a test SHALL show that it ranks a rare-term match above a common-term match on a fixture.

#### Scenario: Rarity matters
- **WHEN** a question contains a rare term and a very common term and the term-rarity ranking is selected
- **THEN** the chunk with the rare term ranks above a chunk that only repeats the common term
