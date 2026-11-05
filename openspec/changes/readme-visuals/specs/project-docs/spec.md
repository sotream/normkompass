## ADDED Requirements

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
