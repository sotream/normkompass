## ADDED Requirements

### Requirement: Honest limits section
The README SHALL contain a section "Honest limits" that states plainly what the project does not do or does not know, and every statement in it SHALL be true for the current repository.

#### Scenario: Reader checks claims
- **WHEN** a reader compares the section with the repository
- **THEN** each limit stated there matches what the code, the eval and the results actually show

### Requirement: No unsupported claims
The README SHALL NOT claim production readiness, scalability, enterprise suitability, legal correctness, up-to-date law, customer use, or any quality figure that no recorded run supports.

#### Scenario: Quality figure
- **WHEN** the README states a metric
- **THEN** the metric appears in a results table with date, commit, and model

### Requirement: Bring your own corpus
The README SHALL contain a section "Bring your own corpus" that explains how to index and evaluate other documents by implementing the corpus adapter interface, and it SHALL be backed by a runnable example that is tested in CI.

#### Scenario: Example runs
- **WHEN** CI runs
- **THEN** the example indexes a small folder of text files and answers a retrieval query from it

#### Scenario: Example breaks
- **WHEN** a change breaks the adapter interface the example uses
- **THEN** the example's test fails
