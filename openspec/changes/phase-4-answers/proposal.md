## Why

The service must answer a question with a citation to a concrete place, or refuse. Retrieval alone
(phase 3) returns passages; phase 4 adds the answer, makes the code (not the model) check every
citation, and defines when the service says "not in the corpus".

## What Changes

- Add `POST /ask`: retrieve passages, generate an answer with Claude through the Anthropic SDK, verify the citations in code, and return `{answer, citations[{source, path, url, quote}], refused, stand}`.
- Add citation verification: every quote must be a verbatim substring of a retrieved chunk; any citation that fails makes the whole response a refusal.
- Add the refusal rule: no supporting chunk, a model refusal, or failed verification yields `refused = true` with an empty answer.
- Add a model abstraction with a stub for tests; the Claude model id comes from configuration, never from code.
- Add a manual eval command that measures citation validity and refusal precision/recall over the eval set with the real model; CI runs the same pipeline with a stub model.
- Add an end-to-end test through the API against Postgres with the fake embedder and a stub model.

Out of scope: choosing the final embedding model and reranker (phase 5), UI, authentication.

## Capabilities

### New Capabilities

- `answer-generation`: the ask endpoint, the response shape, and how a model answer is produced from retrieved passages.
- `citation-verification`: code-level checks that make every returned citation trustworthy.
- `answer-eval`: citation-validity and refusal metrics for the full pipeline.

### Modified Capabilities

None.

## Impact

- New dependency: the Anthropic SDK (a product dependency; the model id is configuration).
- New environment variables for the API key and model id; only placeholders in `.env.example`.
- The manual full eval needs an API key and costs money; CI needs neither.
