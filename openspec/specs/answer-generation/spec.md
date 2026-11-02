# answer-generation Specification

## Purpose
Defines the ask endpoint and how a verified answer is produced from retrieved passages, including the refusal rule, the Stand of the sources and model configuration.

## Requirements

### Requirement: Ask endpoint
The API SHALL expose `POST /ask` accepting a question and returning `{answer, citations, refused, stand}`, where each citation has `source`, `path`, `url`, and `quote`.

#### Scenario: Supported question
- **WHEN** a client asks a question that retrieved passages support
- **THEN** the response has `refused = false`, a non-empty `answer`, at least one citation, and a `stand`
- **AND** every citation's `source`, `path`, and `url` come from a retrieved chunk

#### Scenario: Invalid input
- **WHEN** a client posts an empty or non-string question
- **THEN** the response status is 400

### Requirement: Answers only from retrieved passages
The system SHALL give the model only the retrieved passages as knowledge and SHALL return an answer only when the model's output passes citation verification.

#### Scenario: Model answers without sources
- **WHEN** the model returns an answer with no citations
- **THEN** the response is a refusal

### Requirement: Refusal
The system SHALL refuse, with `refused = true`, an empty `answer`, no citations, and `stand = null`, when retrieval returns no passage, when the model refuses, when the model output cannot be parsed, when verification fails, or when the model call fails.

#### Scenario: Nothing retrieved
- **WHEN** retrieval returns no chunk
- **THEN** the response is a refusal and the model is not called

#### Scenario: Model call fails
- **WHEN** the model call raises an error
- **THEN** the response is a refusal and the error is not shown to the client

### Requirement: Stand of the sources
For an answer, `stand` SHALL contain the Stand statements of the laws that were cited.

#### Scenario: Two laws cited
- **WHEN** citations come from two laws
- **THEN** `stand` contains the Stand of both, separated by "; "

### Requirement: Model by configuration
The Claude model id and API key SHALL be read from configuration; the code SHALL NOT contain a default model id, and `.env.example` SHALL contain no real key.

#### Scenario: Missing configuration
- **WHEN** the API starts without a model id or key
- **THEN** `POST /ask` fails to start the model client with a clear configuration error and no request is sent to the network
