## 1. Provider

- [ ] 1.1 Add `OpenAiCompatibleAnswerModel` using `fetch`, with tests against a stubbed HTTP layer (request shape, auth header, success, non-2xx, unreachable, malformed body, rate-limit retry and its bound)
- [ ] 1.2 Add `openai-compatible` to provider selection with configuration errors for a missing base URL, key or model
- [ ] 1.3 Add the minimum interval between requests, shared by the answer eval
- [ ] 1.4 Add placeholders to `.env.example`

## 2. Eval and docs

- [ ] 2.1 Record provider, model and endpoint host in `pnpm eval:answers` output and result files, never the key
- [ ] 2.2 Document getting a free key and running the eval with it in the README
- [ ] 2.3 Run the answer eval with the user's key and report the result with its label, whatever it shows

## 3. Archive

- [ ] 3.1 Run `openspec archive openai-compatible-provider` and keep the `answer-provider` Purpose filled
