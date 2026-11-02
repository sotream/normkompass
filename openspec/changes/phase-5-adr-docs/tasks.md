## 1. Comparison harness

- [ ] 1.1 Add further local embedding models (multilingual E5 base, and large if it runs) behind the existing `Embedder` interface with tests
- [ ] 1.2 Let `pnpm index` and `pnpm eval:retrieval` take a model name; record model, mode, indexing time and model size in result files
- [ ] 1.3 Add retrieval modes (vector only, full-text only, hybrid) and test that each returns what its name says
- [ ] 1.4 Add an optional local reranker over the top 20 candidates, off by default, with tests

## 2. Runs and decision

- [ ] 2.1 Run the full eval for every local candidate; run cloud candidates only if a key is provided
- [ ] 2.2 Run the ablation and the reranker comparison on the chosen model
- [ ] 2.3 Put all results in the README table and write ADR 0002 with the decision rule, the numbers, the rejected options and the local-versus-cloud trade-off

## 3. Documentation

- [ ] 3.1 Write "Honest limits" in the README
- [ ] 3.2 Write "Bring your own corpus" with a runnable, tested example
- [ ] 3.3 Run `openspec archive phase-5-adr-docs` and fill Purpose sections
