## 1. Provider

- [x] 1.1 Add `OllamaAnswerModel` using `fetch`, with tests against a stubbed HTTP layer (request shape, success, non-2xx, unreachable, malformed body)
- [x] 1.2 Add provider selection to answer model creation with configuration errors for an unknown provider and a missing Ollama model
- [x] 1.3 Add placeholders to `.env.example`

## 2. Eval and docs

- [x] 2.1 Record provider and model in `pnpm eval:answers` output and result files
- [x] 2.2 Document local setup (install Ollama, pull a model, run the eval) in the README
- [x] 2.3 Run the answer eval with a local model once one is installed and report the result with its label

## 3. Archive

- [x] 3.1 Run `openspec archive local-answer-model` and fill the Purpose section
