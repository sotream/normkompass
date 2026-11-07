# answer-eval Specification

## Purpose
Defines the answer evaluation: citation validity, refusal precision and recall, the manual real-model run, the CI run with a scripted model, and honest reporting.

## Requirements

### Requirement: Citation validity metric
The answer eval SHALL report citation validity as the share of citations returned across all answers that pass verification, and SHALL report separately how many answers cite at least one expected norm.

#### Scenario: All citations valid
- **WHEN** every returned citation passes verification
- **THEN** citation validity is 1.0

### Requirement: Refusal metrics
The answer eval SHALL report refusal precision (refusals that were correct among all refusals) and refusal recall (unanswerable questions that were refused among all unanswerable questions), with "refused" as the positive class.

#### Scenario: Perfect refusal behavior
- **WHEN** every unanswerable question is refused and no answerable question is refused
- **THEN** refusal precision and refusal recall are 1.0

#### Scenario: Wrongly refused answerable question
- **WHEN** an answerable question is refused
- **THEN** refusal precision decreases

#### Scenario: Wrongly answered unanswerable question
- **WHEN** an unanswerable question receives an answer
- **THEN** refusal recall decreases

### Requirement: Manual full run and CI subset
The full answer eval with the real model SHALL be a manual command that needs an API key; CI SHALL run the same pipeline over fixtures with a scripted stub model and no network access.

#### Scenario: CI without key
- **WHEN** CI runs without an API key
- **THEN** the stub-based eval runs and the real-model eval is not executed

### Requirement: Honest reporting
The README SHALL state which answer metrics were measured with the real model, with date, commit, and model id, and SHALL state plainly when the full run has not been done.

#### Scenario: Not yet measured
- **WHEN** the real-model eval has not been run
- **THEN** the README says so and shows no invented numbers

### Requirement: Real-model runs are reported with their cost and refusals analyzed
Each recorded real-model run SHALL be reported with model id, date, commit and the cost of the run as read from the provider's usage report, and SHALL list its refusal reasons; answerable questions refused by every recorded model SHALL be named and examined against retrieval, stating what was found and not guessing why.

#### Scenario: Reader checks a Claude row
- **WHEN** a reader looks at a Claude row
- **THEN** the model id, date, commit, cost and refusal reasons are given next to the numbers

#### Scenario: Question refused by all models
- **WHEN** an answerable question is refused in every recorded run
- **THEN** the README names it and says whether the expected passage was among the retrieved ones
