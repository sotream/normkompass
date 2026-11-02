## Why

The only real-model answer result so far comes from a small local model and is weak. Claude has not been
measured because no API key is available. Several hosted providers offer a free tier through an
OpenAI-style chat API, so a larger hosted model can be run through the same eval at no cost, giving a
second, stronger data point. It must never be mistaken for Claude's results.

## What Changes

- Add a third answer provider, `openai-compatible`, that talks to any endpoint implementing the OpenAI-style chat completions API (for example Google Gemini's compatibility endpoint, Mistral, Groq, OpenRouter, DeepSeek). Base URL, API key and model come from configuration.
- Keep `claude` as the default; citation verification and the refusal rule are unchanged and apply to every provider.
- Respect provider rate limits during the answer eval: a configurable pause between requests and jittered exponential backoff on transient failures.
- Record provider, model and endpoint host in every answer eval result; the README labels results by provider and model.
- Document how to obtain a key for one free provider and run the eval with it.

Out of scope: choosing a recommended hosted model (decided by measuring), provider-specific SDKs, streaming, tool use, cost tracking, running the eval in CI.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `answer-provider`: a third provider, its configuration, secret handling and rate-limit behavior.

## Impact

- New environment variables: `ANSWER_BASE_URL`, `ANSWER_API_KEY`, `ANSWER_MIN_INTERVAL_MS`; placeholders only in `.env.example`. `ANSWER_MODEL` is reused.
- No new runtime dependency: the endpoint is called over HTTP with the built-in `fetch`.
- The user creates the provider account and key; the key lives only in the local, git-ignored `.env`.
- Question and source text (public law and synthetic questions) are sent to the chosen third-party host when this provider is selected; the README says so.
