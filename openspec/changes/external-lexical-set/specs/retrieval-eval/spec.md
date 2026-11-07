## ADDED Requirements

### Requirement: Externally written question set
The project MAY keep a question set written by other AI models from corpus text they were given; every question SHALL name its writer and carry `origin: external`, the raw output of each writer SHALL be stored unchanged, and the instruction given to the writers SHALL be kept in the repository.

#### Scenario: Reader audits a question
- **WHEN** a reader looks at an external question
- **THEN** its writer, the raw output it came from and the instruction given are findable in the repository

### Requirement: External questions are validated
Each external question SHALL be checked for structure, that its expected unit exists, and that it is not a copy of a question in another set, and doubtful questions SHALL be flagged `needs_review` instead of being silently dropped or silently kept.

#### Scenario: Copied question
- **WHEN** an external question equals a question in another set
- **THEN** validation reports it and it is not used

### Requirement: External set reported separately
Results on the external set SHALL be reported per writer and overall in a table of their own, SHALL NOT be averaged with other sets, SHALL NOT be used to choose the default search configuration, and SHALL be accompanied by a statement that the writers are models and not users.

#### Scenario: Reporting
- **WHEN** results are published
- **THEN** the external set appears in its own table with its limits stated
