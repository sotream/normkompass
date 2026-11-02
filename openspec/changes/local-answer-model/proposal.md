## Why

Answer generation currently needs a paid cloud model, so the full answer eval cannot be run by
everyone and no real answer numbers exist. A locally running model gives a free way to exercise the
whole pipeline end to end, and it supports the argument that documents need not leave the
infrastructure. It must never be mistaken for Claude's results.

## What Changes

- Add a second answer provider that talks to a locally running Ollama server, selected by configuration.
- Keep Claude as the default provider; the citation verification and refusal rules are unchanged and apply to every provider.
- Record the provider and model in every answer eval result, and require the README to label results by provider and model.
- Document how to install Ollama, pull a model, and run the answer eval locally.

Out of scope: choosing a recommended local model (to be decided by measuring with the eval), other local runtimes, fine-tuning, hosting a model for the API in production.

## Capabilities

### New Capabilities

- `answer-provider`: how the answer model is selected and what a local provider must and must not do.

### Modified Capabilities

None.

## Impact

- New environment variables: `ANSWER_PROVIDER`, `OLLAMA_URL`, `OLLAMA_MODEL`; placeholders only in `.env.example`.
- No new runtime dependency: Ollama is called over HTTP with the built-in `fetch`.
- The user installs Ollama and downloads a model themselves (several GB).
