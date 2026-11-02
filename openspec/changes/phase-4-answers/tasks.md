## 1. Verification and refusal

- [ ] 1.1 Implement citation verification (chunk number, verbatim quote, at least one citation) with unit tests for each failure
- [ ] 1.2 Implement the response builder: citations enriched from chunks, Stand, refusal rules with unit tests

## 2. Model

- [ ] 2.1 Load the `claude-api` skill and take the current model id and SDK usage from it
- [ ] 2.2 Add the `AnswerModel` interface, the scripted stub, and the Claude implementation reading model id and key from configuration
- [ ] 2.3 Write the prompt with delimited sources and the JSON output contract

## 3. API and tests

- [ ] 3.1 Add `POST /ask` with input validation
- [ ] 3.2 Add an end-to-end test: API, Postgres, fake embedder, stub model (valid answer, hallucinated quote, model refusal, no retrieval result)

## 4. Eval

- [ ] 4.1 Add citation-validity and refusal metrics and their unit tests
- [ ] 4.2 Add the manual `pnpm eval:answers` command
- [ ] 4.3 Add a CI eval over fixtures with the stub model
- [ ] 4.4 Document in the README what has and has not been measured (the full run needs an API key)
- [ ] 4.5 Run `openspec archive phase-4-answers` and fill Purpose sections
