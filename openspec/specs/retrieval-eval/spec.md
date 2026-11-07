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

### Requirement: Lexical question set
The project SHALL keep a separate set of lexical questions (exact terms, numbers, citation labels) derived from the corpus text and validated against it, and its results SHALL be reported separately from the paraphrase set and labeled as favoring lexical matching by construction.

#### Scenario: Reporting both sets
- **WHEN** results are published
- **THEN** the paraphrase set and the lexical set appear in separate rows or tables and are not averaged together

### Requirement: Decision uses held-out parts of both sets
A change of the default search configuration SHALL be decided on the development parts of both question sets and confirmed on the held-out parts of both, with the decision rule recorded before the runs.

#### Scenario: Candidate wins only on lexical questions
- **WHEN** a candidate is better on the lexical held-out part but significantly worse on the paraphrase held-out part
- **THEN** it does not become the default and the result is recorded

### Requirement: Decision rule for exact terms and numbers
A change of the default aimed at exact terms and numbers SHALL be decided by a rule recorded before the runs, on the development halves and confirmed on the held-out halves, with paired intervals reported, and a difference whose interval includes zero SHALL NOT be presented as an improvement.

#### Scenario: Gain only on a small subset
- **WHEN** a candidate improves the exact-term questions but is worse on the paraphrase or citation questions
- **THEN** it does not become the default and the result is recorded

#### Scenario: Difference within noise
- **WHEN** the paired interval of the difference includes zero
- **THEN** the documentation says the difference cannot be told from noise
