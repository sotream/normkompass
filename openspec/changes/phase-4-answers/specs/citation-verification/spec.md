## ADDED Requirements

### Requirement: Verbatim quotes
Every returned quote SHALL be a non-empty, verbatim substring of the text of the retrieved chunk it cites, and this SHALL be checked by code.

#### Scenario: Exact quote
- **WHEN** the model cites a chunk with a quote that appears exactly in that chunk's text
- **THEN** the citation is accepted

#### Scenario: Altered quote
- **WHEN** the model's quote differs from the chunk text even by one word
- **THEN** the citation is rejected

#### Scenario: Empty quote
- **WHEN** the quote is empty
- **THEN** the citation is rejected

### Requirement: Citations refer to retrieved chunks
A citation SHALL refer to a chunk that was part of the retrieval result for that question; its path and URL SHALL be taken from that chunk, not from the model.

#### Scenario: Unknown chunk
- **WHEN** the model cites a chunk number that was not provided
- **THEN** the citation is rejected

#### Scenario: Model-supplied path
- **WHEN** the model output includes a path or URL of its own
- **THEN** it is ignored and the chunk's path and URL are used

### Requirement: Strict failure
If any citation of a model answer is rejected, the whole response SHALL be a refusal.

#### Scenario: One bad citation among good ones
- **WHEN** two citations are valid and one quote is invented
- **THEN** the response is a refusal with no answer text

### Requirement: No unverified answer
The service SHALL NOT return an answer as an answer unless it has at least one verified citation.

#### Scenario: Answer without citation
- **WHEN** the model output has `refused = false` and an empty citation list
- **THEN** the response is a refusal
