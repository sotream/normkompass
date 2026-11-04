## Why

ADR 0003 made vector-only the default because no hybrid variant beat it. It also recorded two open points: why the full-text ranking hurts was never analyzed, and the question set is made of paraphrases that favor embeddings, so the value of lexical matching (exact terms, numbers, citations such as "§ 14 Abs. 1 UStG") was never measured. Without both, the project cannot say whether its full-text side is broken, merely unhelpful on this question style, or genuinely useful for another style.

## What Changes

- Diagnose the full-text ranking: for each answerable question record where full-text and vector ranking place the expected unit and what outranks it, and state the findings (a hypothesis to check: the current ranking has no term-rarity weighting, so very common words dominate).
- Add a second question set of lexical questions (exact terms, numbers, citation lookups) derived from the corpus text, reported separately from the paraphrase set and labeled as favoring lexical matching by construction.
- Try a short, fixed list of changes to the lexical side (an in-application BM25-style ranking with term rarity and length normalization, direct matching of citation labels, a strict phrase query with fallback), measured on development halves of both sets and decided by a rule written before the runs.
- Keep vector-only as the default unless a hybrid configuration is at least as good as vector-only on the held-out part of the paraphrase set and better on the held-out part of the lexical set; record the result in an ADR either way.

Out of scope: new embedding models, generation, production-scale lexical indexing, any claim that the results hold for other corpora.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `hybrid-search`: the lexical ranking is diagnosed, and any adopted lexical ranking is explicit and tested.
- `retrieval-eval`: a separately reported lexical question set.

## Impact

- A new question file and eval options; no change to the default search mode unless the decision rule is met.
- New tests for the lexical ranking; no new dependencies (the ranking runs in the application over the existing chunks).
- README and ADR updates with the diagnosis and the results.
