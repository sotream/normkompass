## Context

Phase 3 measured one embedding model (multilingual-e5-small, local) at recall@5 0.880 and MRR 0.742
on 75 questions. Nothing was compared yet, so any claim that this model is a good choice is unsupported.

## Decisions

- **Candidates**: local models that transformers.js can run and that cover German (the multilingual
  E5 family in different sizes). Cloud embedding models (OpenAI text-embedding-3, Voyage multilingual) are
  evaluated only if the owner provides a key; otherwise the ADR lists them as "not evaluated" with the reason.
- **Same conditions**: every model is indexed into its own embedding table and evaluated on the same
  question set with the same hit definition and depth. Indexing time and the size of the model are recorded,
  because the local-versus-cloud argument depends on them.
- **Ablation**: for the chosen configuration the eval also reports vector-only and full-text-only
  rankings, so the contribution of hybrid search and of the compound splitting is visible.
- **Reranker**: a local cross-encoder is tried on the top 20 candidates. It is adopted only if it improves
  both recall@5 and MRR on the full set; otherwise the ADR records it as rejected with the numbers.
- **Decision rule**: the ADR states the rule before the numbers are read: prefer the model with the best
  MRR; if two models differ by less than the noise one can expect from 75 questions (a few points), prefer
  the smaller and cheaper one and say so.
- **Honest limits**: the README lists what is not known or not done, in plain statements backed by the repository.
- **Bring your own corpus**: the documented path is to implement `CorpusSource`, build units, and call the
  indexing and eval functions; a runnable example with a small folder of text files is included and tested in CI.
  The markdown source used by tests stays a test fixture and is not turned into a product feature.

## Risks

- 75 questions are few; small differences between models are not significant, and the ADR says so.
- Large local models are slow to index on a laptop; the cost is reported instead of hidden.
