## ADDED Requirements

### Requirement: Unambiguous expected answers
Each answerable question SHALL have an expected unit set that contains every unit of the corpus that answers it equally well, and a question that two different units answer differently SHALL be reworded or removed.

#### Scenario: Two norms answer differently
- **WHEN** a question is answered by two units that give different answers
- **THEN** the question is reworded to single out one of them, or it is flagged as needing review

### Requirement: Held-out reporting for tuning
When search parameters are chosen by measuring on the eval set, the questions SHALL be split deterministically into a development part and a held-out part, parameters SHALL be chosen on the development part only, and the result SHALL be reported on the held-out part.

#### Scenario: Reporting a tuned configuration
- **WHEN** a tuned configuration is reported
- **THEN** its held-out numbers are given and the number of variants tried is stated
