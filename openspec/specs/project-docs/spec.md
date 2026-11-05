# project-docs Specification

## Purpose
Define what the project documentation must state: honest limits, no unsupported claims, and a tested path for indexing and evaluating other documents.

## Requirements

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

### Requirement: Architecture diagram
The README SHALL contain an architecture diagram kept as text in the repository that shows how a question becomes either a cited answer or a refusal, including the indexes, the search, the answer generation, the citation check, and the refusal path.

#### Scenario: Reader follows a question
- **WHEN** a reader looks at the diagram
- **THEN** it shows that an answer with a citation that does not verify is replaced by a refusal

### Requirement: Charted numbers are traceable
Every number shown in a chart in the documentation SHALL come from a recorded result file, and the charts SHALL be shown with the same caveats as the tables they summarize.

#### Scenario: Reader checks a bar
- **WHEN** a reader compares a chart value with the recorded result files
- **THEN** it matches the file, and the chart's surrounding text states the sample size and who wrote the questions

### Requirement: Detail stays reachable
Restructuring the README for readability SHALL NOT remove a result table, a number, or a stated limit; detailed tables MAY be collapsed.

#### Scenario: Reader wants the table
- **WHEN** a reader looks for a number that was in the README before the restructuring
- **THEN** it is still in the README or in a document the README links to
