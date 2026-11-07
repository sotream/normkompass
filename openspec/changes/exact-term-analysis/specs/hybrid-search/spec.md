## ADDED Requirements

### Requirement: The exact-term gap is analyzed
The project SHALL record, from a reproducible analysis, where the default ranking and the older full-text ranking place the expected unit of each exact-term and number question and what outranks it, and the documentation SHALL state each cause as confirmed only when a measurement that could have refuted it supports it.

#### Scenario: Reader asks why the older ranking is better on numbers
- **WHEN** a reader checks the documentation for the cause
- **THEN** it cites the analysis, and every explanation not confirmed by a measurement is marked as a hypothesis

### Requirement: Changes to the lexical ranking are explicit options
Any change to the lexical ranking that follows from the analysis SHALL be an explicit, documented search option with a test that shows the behavior on a fixture, and SHALL NOT change the default unless the decision rule is met.

#### Scenario: Candidate not adopted
- **WHEN** a candidate does not meet the decision rule
- **THEN** it remains an option, the default is unchanged, and the result is recorded
