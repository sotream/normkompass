## ADDED Requirements

### Requirement: Lexical question set
The project SHALL keep a separate set of lexical questions (exact terms, numbers, citation labels) derived from the corpus text and validated against it, and its results SHALL be reported separately from the paraphrase set and labeled as favoring lexical matching by construction.

#### Scenario: Reporting both sets
- **WHEN** results are published
- **THEN** the paraphrase set and the lexical set appear in separate rows or tables and are not averaged together

### Requirement: Decision uses held-out parts of both sets
A change of the default search configuration SHALL be decided on the development parts of both question sets and confirmed on the held-out parts of both, with the decision rule recorded before the runs.

#### Scenario: Candidate wins only on lexical questions
- **WHEN** a candidate is better on the lexical held-out part but significantly worse on the paraphrase held-out part
- **THEN** it does not become the default and the result is recorded
