## ADDED Requirements

### Requirement: Real-model runs are reported with their cost and refusals analyzed
Each recorded real-model run SHALL be reported with model id, date, commit and the cost of the run as read from the provider's usage report, and SHALL list its refusal reasons; answerable questions refused by every recorded model SHALL be named and examined against retrieval, stating what was found and not guessing why.

#### Scenario: Reader checks a Claude row
- **WHEN** a reader looks at a Claude row
- **THEN** the model id, date, commit, cost and refusal reasons are given next to the numbers

#### Scenario: Question refused by all models
- **WHEN** an answerable question is refused in every recorded run
- **THEN** the README names it and says whether the expected passage was among the retrieved ones
