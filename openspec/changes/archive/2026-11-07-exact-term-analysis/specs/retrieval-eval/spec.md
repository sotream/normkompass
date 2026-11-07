## ADDED Requirements

### Requirement: Decision rule for exact terms and numbers
A change of the default aimed at exact terms and numbers SHALL be decided by a rule recorded before the runs, on the development halves and confirmed on the held-out halves, with paired intervals reported, and a difference whose interval includes zero SHALL NOT be presented as an improvement.

#### Scenario: Gain only on a small subset
- **WHEN** a candidate improves the exact-term questions but is worse on the paraphrase or citation questions
- **THEN** it does not become the default and the result is recorded

#### Scenario: Difference within noise
- **WHEN** the paired interval of the difference includes zero
- **THEN** the documentation says the difference cannot be told from noise
