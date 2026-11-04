## Decisions

- **Diagnosis before any change.** The first step is a recorded analysis, not a fix: where do full-text and vector ranking place each expected unit, which units outrank it, and how many questions can full-text solve that vector cannot. If vector already misses very few questions (3 of 75 reached no top-5 hit), the headroom of any hybrid on the paraphrase set is small, and the document says so.
- **A lexical question set, reported separately.** About 25 to 30 questions that quote exact terms, numbers or citation labels, derived from the corpus text. Such questions favor lexical matching by construction, so they are never merged into the existing numbers, the README labels them, and a win there is not presented as a general result. As before, the author of the questions also reviews them, which the documents state.
- **Development and held-out parts for both sets**, split deterministically as before (odd numbers develop, even numbers held out); candidates are chosen on development parts only.
- **A fixed, short candidate list**, all reported: (1) a BM25-style ranking computed in the application over the chunk text with term rarity and length normalization, replacing the full-text rank in the fusion; (2) exact matching of citation labels and paths for questions that contain one, boosting those units; (3) a strict phrase or AND query with a fallback to the OR query. Each can be combined with the existing fusion weight.
- **Decision rule, stated before the runs.** Pick the candidate with the best MRR on the combined development parts. It becomes the default only if (a) on the held-out paraphrase questions it is not significantly worse than vector-only (95% paired bootstrap) and (b) on the held-out lexical questions it is better than vector-only; if several candidates tie, prefer the simpler one. Otherwise vector-only stays the default, and the finding (including whether lexical matching is useful when selected explicitly) is recorded.
- **Scale honesty.** An in-application ranking over about 4,600 chunks says nothing about large corpora; the documents make no scalability claim.

## Risks

- Questions written by the same author favor whatever the author already believes; the decision rule uses held-out parts and separate reporting to limit this, not to remove it.
- 37 or so questions per held-out part give wide intervals.
