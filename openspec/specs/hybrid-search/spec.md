# hybrid-search Specification

## Purpose
Defines how a question is ranked against the index: the search modes (vector-only by default, German full-text, and hybrid merged with weighted Reciprocal Rank Fusion), compound-word handling, and the search endpoint.

## Requirements

### Requirement: Search modes
Search SHALL support vector-only, full-text-only and hybrid modes, SHALL use vector-only by default, and in hybrid mode SHALL combine vector similarity and German full-text search results with weighted Reciprocal Rank Fusion; every mode SHALL return the best chunks with their metadata and scores.

#### Scenario: Default mode
- **WHEN** a search is run without a mode
- **THEN** it ranks by vector similarity only

#### Scenario: Both signals contribute in hybrid mode
- **WHEN** a question matches one chunk mainly by meaning and another mainly by exact words and the hybrid mode is selected
- **THEN** both chunks appear in the merged result

#### Scenario: Result content
- **WHEN** a search returns results
- **THEN** each result contains source, path, label, title, URL, Stand, and original text

### Requirement: German morphology in full-text search
Full-text search SHALL use the German text-search configuration, so inflected forms of a word match.

#### Scenario: Inflected form
- **WHEN** a question uses "Rechnungen"
- **THEN** chunks containing "Rechnung" are found

### Requirement: German compound words
Search SHALL split query compound words into parts known from the corpus vocabulary and include the parts in the full-text query.

#### Scenario: Compound in the question
- **WHEN** a question contains "Umsatzsteuervoranmeldung"
- **THEN** chunks that contain "Voranmeldung" or "Umsatzsteuer" are candidates

#### Scenario: Unknown word
- **WHEN** a question word cannot be split into known parts
- **THEN** it is searched unchanged

### Requirement: Search endpoint
The API SHALL expose search over HTTP, accepting a question and a result limit and returning ranked chunks.

#### Scenario: Valid request
- **WHEN** a client posts a question to the search endpoint
- **THEN** the response is 200 with a ranked list of at most the requested number of chunks

#### Scenario: Empty question
- **WHEN** a client posts an empty question
- **THEN** the response is 400

### Requirement: Hybrid is not worse than its vector component
The default search configuration SHALL NOT be significantly worse, on the held-out questions of the retrieval eval, than vector-only search with the same embedding model; if no hybrid configuration meets this, the default SHALL be the best measured configuration and the decision record SHALL state why.

#### Scenario: Hybrid underperforms
- **WHEN** no measured hybrid variant is at least as good as vector-only within the stated noise on the held-out questions
- **THEN** the default is not hybrid and the decision record states the finding and the numbers

### Requirement: Fusion weights are explicit
Any weighting of the full-text ranking against the vector ranking SHALL be an explicit, documented search option with a stated default, and SHALL NOT be implied by constants hidden in the code.

#### Scenario: Weight changed
- **WHEN** a different full-text weight is given in the search options
- **THEN** the ranking changes accordingly and a test shows the effect on a fixture
