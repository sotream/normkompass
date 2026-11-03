# retrieval-comparison Specification

## Purpose
Define how embedding models, search modes and a reranker are compared on one question set, and how the decision is recorded, so that the choice of retrieval setup rests on measured, reproducible numbers.

## Requirements

### Requirement: Compare embedding models on one question set
The retrieval eval SHALL be runnable for several embedding models on the same question set, with the same hit definition and depth, and each result SHALL record the model name, retrieval mode, indexing time and date.

#### Scenario: Two models
- **WHEN** the eval is run for two different embedding models
- **THEN** both results are produced from the same questions and are directly comparable
- **AND** each result file names its model

### Requirement: Unevaluated candidates are stated
A candidate embedding model that was not evaluated, for example because it needs an API key that was not provided, SHALL be listed as not evaluated with the reason, and SHALL NOT have any quality figure attributed to it.

#### Scenario: No API key
- **WHEN** a cloud embedding model is a candidate and no key is available
- **THEN** the ADR lists it as not evaluated and states why

### Requirement: Retrieval modes
Search SHALL support vector-only, full-text-only and hybrid modes, and the eval SHALL report the metrics of each mode for the chosen model.

#### Scenario: Vector-only mode
- **WHEN** a search runs in vector-only mode
- **THEN** no result has a full-text rank

#### Scenario: Full-text-only mode
- **WHEN** a search runs in full-text-only mode
- **THEN** no result has a vector rank

### Requirement: Reranker only on evidence
A reranker SHALL be off by default and SHALL be adopted only if it improves both recall@5 and MRR on the full eval; otherwise the decision record SHALL state that it was rejected and give the numbers.

#### Scenario: Reranker does not help
- **WHEN** the reranker does not improve both metrics
- **THEN** it stays disabled and the ADR records the rejection with the measured numbers

### Requirement: Decision record
ADR 0002 SHALL record the choice of embedding model and the decision on the reranker, state the decision rule before it applies it, reference the README results table, discuss the local-versus-cloud trade-off, and state the limits of the evidence.

#### Scenario: Close results
- **WHEN** two models differ by less than the stated noise margin
- **THEN** the ADR applies the stated tie-breaking rule and says that the difference is not significant
