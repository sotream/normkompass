## Why

Citations are only as good as retrieval. Before any answer generation, the system needs an
index over the parsed corpus, a hybrid search that finds the right passages, and a measurable
way to know how well it does. Retrieval quality is evaluated without an LLM so it is cheap,
repeatable, and runs in CI.

## What Changes

- Add an index in Postgres: every corpus unit stored as a chunk with metadata, a vector embedding, and a German full-text vector.
- Embed each chunk with a context prefix ("<Law> § <number> <title>") placed before its text.
- Add hybrid search: vector similarity and full-text search merged with Reciprocal Rank Fusion (RRF); German compound words are handled explicitly.
- Add an `Embedder` interface with a local multilingual implementation and a deterministic fake for tests; paid providers are added only for the manual full run.
- Add eval set v1: 60-100 German questions plus 10-15 questions with no answer in the corpus, each with expected norms taken from the corpus text.
- Add retrieval metrics (recall@5, MRR) and a command that prints them; a small CI subset runs without paid APIs.
- Add a README table of retrieval results with date and commit.

Out of scope: answer generation, quote verification, refusal logic (phase 4); choosing the final embedding model and reranker (phase 5 ADR). Retrieval-side refusal metrics are not computed here.

## Capabilities

### New Capabilities

- `chunk-index`: storing corpus units as searchable chunks.
- `hybrid-search`: ranking chunks for a question.
- `retrieval-eval`: the eval set and retrieval metrics.

### Modified Capabilities

None.

## Impact

- New workspace packages for indexing/search and eval; new database schema (migrations).
- New `pnpm index` and `pnpm eval:retrieval` commands; new `eval/` directory with the question set.
- New runtime dependency for local embeddings; no secrets needed for CI.
