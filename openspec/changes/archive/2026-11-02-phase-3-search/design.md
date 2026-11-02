## Context

Phase 2 produces `CorpusUnit` objects (about 4400 for the five demo laws). Phase 3 turns
them into a searchable index and measures retrieval. The embedding model is not final:
phase 5 chooses it by eval, so the index must make switching models cheap.

## Decisions

- **Chunk = unit.** Each Absatz, Nummer, or whole-norm unit is one chunk. Very long units
  (for example an Anlage table of tens of thousands of characters) are split into consecutive
  parts at line boundaries, each part keeping the unit's path and a part number. Embedding
  input is limited to the model's input size; the full text stays in the stored chunk.
- **Embedding input** is "<label> <title>\n<text>", for example "§ 14 Abs. 1 UStG Ausstellung von Rechnungen\n(1) Rechnung ist ...".
  The stored and returned text is the unit text without the prefix, so later quote checks
  work on the original wording.
- **Embedder interface**: `embed(texts, kind: 'query' | 'passage')`, plus model name and dimension.
  Implementations: local multilingual-e5 via transformers.js (default for CI and eval), and a
  deterministic hashing fake for unit tests. E5 models need "query: " and "passage: " prefixes,
  which belong to the implementation.
- **Model switching**: embeddings are stored per model name in a table keyed by
  (chunk, model). One table exists per vector dimension and is created on demand, so the
  vector column stays typed. At about 4,600 chunks the search is an exact scan; an ANN index
  (HNSW) is deferred until the corpus size makes it necessary.
- **Full-text search**: Postgres `german` configuration on "<title> <text>", stored as a generated `tsvector` with a GIN index.
- **Hybrid ranking**: take top 50 from vector search and top 50 from full-text search, merge with RRF (k = 60), return top N.
- **German compounds**: query terms are additionally split into parts using the corpus
  vocabulary (known words of at least 4 characters), and the parts are added to the full-text
  query with OR. Example: "Umsatzsteuervoranmeldung" also searches "Umsatzsteuer" and "Voranmeldung".
  Alternatives such as trigram matching are left for the eval to compare later.
- **Eval questions** are written only from corpus text: each question is derived from a
  specific unit that is cited as its source, never from memory of the law. Uncertain items
  carry `needs_review: true`. Questions are generated and then checked by a script that
  verifies every expected path exists in the parsed corpus.
- **CI subset**: a small set of questions over fixture units, using the fake embedder and a
  Postgres service; the full set with the real local embedder is a manual command.
- **Metrics**: recall@5 over expected norms (a hit if any expected unit or its parent Absatz/§ is in the top 5), and MRR of the first hit. Questions without an answer are excluded from these two metrics.

## Risks

- Eval questions written by one author for one corpus overfit; the README reports results honestly with sample size and marks weak areas.
- The local embedder download is large and slows a first run; it is cached outside the repository.
- Hit definition (unit vs. parent) affects the numbers; it is fixed in the spec and reported.
