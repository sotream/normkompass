## ADDED Requirements

### Requirement: Charts are generated from recorded results
The project SHALL generate its result charts with a script from the recorded result files and SHALL NOT keep hand-drawn or hand-typed charts.

#### Scenario: Regenerating
- **WHEN** the generator runs on the recorded results
- **THEN** it writes the chart files without manual input

### Requirement: Charts cannot drift
CI SHALL fail when a committed chart differs from the output of the generator for the recorded results.

#### Scenario: Result changes, chart does not
- **WHEN** a result file changes and the committed chart is not regenerated
- **THEN** the CI check fails

### Requirement: Question sets are not merged
A chart SHALL NOT average the paraphrase set and the lexical set; it SHALL show them separately and label the lexical set as favoring lexical matching by construction.

#### Scenario: Retrieval chart
- **WHEN** the retrieval chart is drawn
- **THEN** the two sets appear in separate panels with their own labels

### Requirement: Uncertainty is shown
Where a recorded comparison has a confidence interval, the chart SHALL show it, and SHALL NOT present a difference whose interval includes zero as an improvement.

#### Scenario: Embedding models
- **WHEN** the embedding model chart is drawn
- **THEN** each model's score is shown with its interval and the chart states that the differences are not significant

### Requirement: Readable everywhere
Each chart SHALL be readable in light and dark themes and at phone width, and SHALL have a title and a text description.

#### Scenario: Dark theme
- **WHEN** a chart is viewed in a dark theme
- **THEN** its text and shapes remain legible
