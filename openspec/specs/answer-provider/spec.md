# answer-provider Specification

## Purpose
Define how the answer pipeline selects and configures its answer model provider (Claude or a local Ollama model), so that provider choice is explicit configuration and results are always labeled with the provider and model used.

## Requirements

### Requirement: Provider selection by configuration
The answer model provider SHALL be selected by configuration: `claude` is the default, `ollama` selects a locally running Ollama server, and any other value SHALL be rejected as a configuration error.

#### Scenario: Default provider
- **WHEN** no provider is configured
- **THEN** the Claude provider is used

#### Scenario: Unknown provider
- **WHEN** the configured provider is neither `claude` nor `ollama`
- **THEN** answer generation fails with a configuration error naming the allowed values and no request is sent

### Requirement: Local provider configuration
The Ollama provider SHALL read its server URL and model name from configuration; the URL SHALL default to the local default address, and the model name SHALL have no default in code.

#### Scenario: Model missing
- **WHEN** the Ollama provider is selected and no model name is configured
- **THEN** answer generation fails with a configuration error and no request is sent

### Requirement: Local calls stay local
The Ollama provider SHALL send requests only to the configured server URL and SHALL NOT send question or document text to any other host.

#### Scenario: Request target
- **WHEN** a question is answered with the Ollama provider
- **THEN** exactly one request is made, to the configured URL

### Requirement: Same checks for every provider
Citation verification and the refusal rule SHALL apply unchanged to the output of every provider.

#### Scenario: Local model invents a quote
- **WHEN** the local model returns a quote that is not a verbatim substring of the cited chunk
- **THEN** the response is a refusal with no answer text

### Requirement: Provider failures become refusals
A failure of the provider (server unreachable, non-success status, or unreadable response) SHALL produce a refusal and SHALL NOT expose error details to the client.

#### Scenario: Server not running
- **WHEN** the Ollama server is not reachable
- **THEN** the response is a refusal and the error is only logged on the server

### Requirement: Results are labeled by provider and model
Every answer eval result SHALL record the provider and model that produced it, and the README SHALL NOT present results of a local model as results of Claude.

#### Scenario: Local run
- **WHEN** the answer eval runs with the Ollama provider
- **THEN** the result file states provider `ollama` and the model name
- **AND** the README table row names the same provider and model
