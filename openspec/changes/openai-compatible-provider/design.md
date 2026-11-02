## Decisions

- **One generic provider instead of one per vendor.** The chat completions request shape is widely shared, so a single provider with a configurable base URL covers the free tiers worth trying and keeps the code small. Vendor-specific features are not used.
- **Structured output requested via `response_format` with a JSON schema.** The model's reply is still parsed and verified by the existing code, so the provider is trusted for nothing. If an endpoint rejects the schema parameter, the run fails visibly (a provider failure becomes a refusal and is counted as `model-error`); the implementation checks the chosen endpoint's documentation and the first real run before the result is reported.
- **Rate limits are part of the provider.** Free tiers allow only a few requests per minute. A configurable minimum interval between requests and a small, bounded number of retries with a wait on HTTP 429 keep a full 89-question run from failing for a reason unrelated to answer quality. A request that still fails is counted, not hidden.
- **Secrets.** The key is read from the environment, sent only in the authorization header to the configured base URL, and never logged, printed or written to result files. Result files record the host, not the full URL.
- **Determinism.** Temperature 0 is requested; some endpoints ignore a seed, so repeatability is not promised for hosted models.

## Risks

- Hosted free models change or are retired without notice; the result file records the model name and the date so a row stays interpretable.
- Compatibility endpoints differ in small ways; the stubbed-HTTP tests cover only the request shape this project sends.
