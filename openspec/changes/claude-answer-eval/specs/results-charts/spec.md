## ADDED Requirements

### Requirement: Answer chart covers every recorded model
The answer-evaluation chart SHALL show every recorded model run, SHALL NOT be titled or described as lacking a model that has been recorded, and SHALL state that one run per model is not a ranking.

#### Scenario: Claude recorded
- **WHEN** Claude runs exist in the results
- **THEN** the chart shows them and does not say Claude was not measured
