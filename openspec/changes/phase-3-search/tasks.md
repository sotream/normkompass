## 1. Index

- [x] 1.1 Add migrations: chunks table with metadata, generated German tsvector, GIN index; embeddings table per vector dimension (exact search, no ANN index at this corpus size)
- [x] 1.2 Add `Embedder` interface, deterministic fake, and local multilingual-e5 implementation
- [x] 1.3 Implement chunking of units, including splitting of over-long units
- [x] 1.4 Add `pnpm index`: embed and store all units, idempotent on re-run
- [x] 1.5 Integration tests against Postgres (Compose service in CI)

## 2. Search

- [x] 2.1 Implement vector search and full-text search
- [x] 2.2 Implement RRF merge and a search function returning chunks with scores
- [x] 2.3 Implement corpus-vocabulary compound splitting for queries; test with real compound words
- [x] 2.4 Expose search through the API (`POST /search`) with tests

## 3. Eval

- [x] 3.1 Define `eval/questions.jsonl` schema and a validator that checks expected paths against the corpus
- [x] 3.2 Write questions: 60-100 answerable, 10-15 not in the corpus, each with source place; flag uncertain ones
- [x] 3.3 Implement recall@5 and MRR and `pnpm eval:retrieval`
- [x] 3.4 Add the small CI subset on fixtures and run it in CI
- [x] 3.5 Run the full eval, add the results table (date, commit) to the README, report weak results as they are
- [x] 3.6 Run `openspec archive phase-3-search` and fill Purpose sections
