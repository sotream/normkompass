## ADDED Requirements

### Requirement: Hybrid ranking
Search SHALL combine vector similarity and German full-text search results with Reciprocal Rank Fusion and return the best chunks with their metadata and scores.

#### Scenario: Both signals contribute
- **WHEN** a question matches one chunk mainly by meaning and another mainly by exact words
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
