## Why

The embedding model and the question of a reranker were left open on purpose: they are to be decided
by the eval, not by taste. The README also still lacks two things a reader needs before relying on this
repository: an honest list of its limits, and instructions for plugging in their own documents.

## What Changes

- Extend the retrieval eval so several embedding models can be compared on the same question set, and add a switch for a reranker.
- Report an ablation (vector only, full-text only, hybrid) next to each model's recall@5 and MRR.
- Evaluate the candidates that can run locally; candidates that need a paid API key are evaluated only when a key is available and are otherwise listed as not evaluated, never guessed.
- Write ADR 0002 that chooses the embedding model, decides about the reranker, and cites the README results table; it also records the local-versus-cloud trade-off.
- Add the README sections "Honest limits" and "Bring your own corpus", the latter backed by a tested example.

Out of scope: UI, authentication, deployment, other corpora than the demo laws, fine-tuning.

## Capabilities

### New Capabilities

- `retrieval-comparison`: comparing embedding models, retrieval modes and a reranker on the eval, and recording the decision.
- `project-docs`: the honest-limits and bring-your-own-corpus documentation and its guarantees.

### Modified Capabilities

None.

## Impact

- The eval commands gain model and mode options; result files record them.
- New runtime options for embedding models; no new service is required.
- A new example file with a test; new ADR; README sections.
