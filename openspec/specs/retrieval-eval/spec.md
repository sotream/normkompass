# retrieval-eval Specification

## Purpose
Defines the retrieval evaluation: the question set, how it is derived and validated, the recall@5 and MRR metrics, the CI subset, and the published results.

## Requirements

### Requirement: Eval question set
The repository SHALL contain `eval/questions.jsonl` with 60 to 100 German questions that the corpus answers and 10 to 15 questions that it does not, where each answerable question lists its expected norms and the source place its wording comes from.

#### Scenario: Set size
- **WHEN** the eval set is validated
- **THEN** it has between 60 and 100 answerable and between 10 and 15 unanswerable questions

#### Scenario: Expected norms exist
- **WHEN** the eval set is validated against the parsed corpus
- **THEN** every expected path refers to an existing unit
- **AND** validation fails otherwise

### Requirement: Questions derived from corpus text only
Questions and expected norms SHALL be derived from the corpus text; uncertain items SHALL be marked `needs_review: true`.

#### Scenario: Uncertain question
- **WHEN** an author is unsure that a question has exactly the listed expected norms
- **THEN** the item carries `needs_review: true`

### Requirement: Retrieval metrics
The eval command SHALL report recall@5 and mean reciprocal rank (MRR) over the answerable questions, counting a hit when a returned chunk is an expected unit or its parent Absatz or §.

#### Scenario: Perfect retrieval
- **WHEN** every expected norm is ranked first for its question
- **THEN** recall@5 is 1.0 and MRR is 1.0

#### Scenario: Miss
- **WHEN** no expected norm appears in the top results of a question
- **THEN** that question contributes 0 to recall@5 and to MRR

### Requirement: CI eval without paid services
CI SHALL run a small eval subset using only fixtures, a deterministic embedder, and a database service, and SHALL fail when the subset's metrics fall below defined thresholds.

#### Scenario: Regression
- **WHEN** a change makes the CI subset's recall@5 drop below its threshold
- **THEN** CI fails

### Requirement: Published results
The README SHALL contain a results table of the full eval with date, commit, embedding model, and sample size, and SHALL NOT omit weak results.

#### Scenario: Weak result
- **WHEN** a metric is low
- **THEN** it is still shown in the table
