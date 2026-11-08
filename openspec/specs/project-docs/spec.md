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

### Requirement: Title block with verifiable badges
The README SHALL open with a project title and a one-line description, followed by badges, and each badge SHALL state a fact that can be checked in the repository (CI status, license, required runtime, language, database) and SHALL have alt text.

#### Scenario: Reader checks a badge
- **WHEN** a reader compares a badge with the repository
- **THEN** the badge matches the workflow, the license file, the declared runtime or the stack it names

#### Scenario: Quality badge
- **WHEN** a badge would express a measured quality figure or a readiness claim
- **THEN** it is not shown

### Requirement: Table of contents
The README SHALL contain a table of contents near the top that links to every second-level section, and a test SHALL fail when a section is missing from it or a link points to no section.

#### Scenario: New section
- **WHEN** a second-level section is added to the README without a table of contents entry
- **THEN** the test fails

#### Scenario: Reader jumps
- **WHEN** a reader follows a table of contents link
- **THEN** it leads to the section of that name

### Requirement: Related projects
The README SHALL link a related repository only if it exists, and SHALL state what it is and its real status in one or two sentences, without claiming features it does not have.

#### Scenario: Companion repository in development
- **WHEN** the companion repository exists but is not finished
- **THEN** the README says it is in development

### Requirement: Site linked and held to the same claim rules
The README SHALL link the project website once it is deployed, and the "no unsupported claims" requirement SHALL apply to the site exactly as it applies to the README.

#### Scenario: Reader follows the link
- **WHEN** a reader follows the README link to the site
- **THEN** the site states the same results and limits as the README

### Requirement: Limits describe what the Claude runs show
Once Claude runs are recorded, the limits section SHALL say they are one run per model on questions written by Claude and reviewed by the owner, that they show no spread, and that they do not rank models.

#### Scenario: Reader reads the limits
- **WHEN** a reader reads the limits section
- **THEN** it no longer says Claude is unmeasured and states what the Claude runs cannot show
