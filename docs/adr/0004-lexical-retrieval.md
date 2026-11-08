# 0004. Lexical retrieval: diagnosis, a lexical question set and the default search

- Status: Accepted
- Date: 2026-11-04

## Context

[ADR 0003](0003-hybrid-tuning-and-default-mode.md) made vector-only the default and left two points open: why
the full-text ranking hurts was never analyzed, and the paraphrase-style questions favor embeddings, so the value
of lexical matching (exact terms, numbers, citations such as "§ 14 Abs. 1 UStG") was never measured. This ADR
records the analysis, a second question set, three candidate improvements and the decision.

## Diagnosis

`pnpm eval:diagnose` ranks every answerable question with vector and with Postgres full-text search (top 50) and
counts who finds the expected unit in the top 5.

| Question set                                 | both | vector only | full-text only | neither |
| -------------------------------------------- | ---- | ----------- | -------------- | ------- |
| paraphrase, 75 questions                     | 46   | 26          | 1              | 2       |
| lexical, 28 questions (added by this change) | 14   | 5           | 1              | 8       |

On the paraphrase set full-text finds one question that vector misses (q057), so any hybrid had almost no room to
help there; vector missed only 3 of 75.

Why does full-text rank the wrong unit first? Postgres `ts_rank_cd` has no term-rarity weighting. The analysis
checks this directly, with crude stems (the first six letters of each word): in the 28 paraphrase questions where
full-text had no hit in the top 5 and put a wrong unit first, a rarity-weighted word overlap prefers the expected
unit over that wrong unit in 24 cases (ties 2, prefers the wrong unit 2). In the lexical set the figures are 6, 7
(ties, mostly citation questions that share no words) and 0 out of 13. This supports the explanation that the
missing rarity weighting is a main cause; it is an indication from a crude measure and a comparison with the first
wrong unit only, and it does not prove that nothing else contributes.

## The lexical question set

`eval/lexical-questions.jsonl`: 28 answerable questions in three styles (10 exact rare terms, 9 numbers or amounts,
9 citation lookups such as "Was regelt § 172 Abs. 1 AO?"), derived from the corpus text and validated by code: each
quoted term occurs in the expected unit, each citation equals the label of the expected unit, and no unrelated unit
contains all the terms (apparent ambiguities were decided one by one and recorded with a reason in `not_expected`;
ten apparent ambiguities came up: four questions were dropped and six were recorded with a reason). Six questions that needed such a judgment are flagged
`needs_review`. The set **favors lexical matching by construction** and is reported separately from the paraphrase
set; the questions were chosen and checked by the same author, not by anyone else.

## Decision rule

Fixed before the runs (rule in the merged change `lexical-retrieval`; the candidate list below was written before the
first run):

- Both sets are split by question number as before (odd: development, even: held-out). Development: 38 paraphrase and
  14 lexical questions.
- Eight configurations on the development parts: vector-only and the previous hybrid (Postgres full-text, OR query,
  weight 1) as references, and six candidates: BM25 in the hybrid (weight 1 and 0.5), vector plus citation matching,
  BM25 plus citation matching, a strict AND query with fallback to OR (weight 1 and 0.5).
- The candidate with the best MRR over the pooled development questions of both sets is the finalist.
- It becomes the default only if on the held-out paraphrase questions it is not significantly worse than vector-only
  and on the held-out lexical questions it is better than vector-only. "Better" was read as a 95% paired-bootstrap
  interval above zero; that reading was my intention before the held-out runs but was not written down until here.

## Results

Development half, MRR (pooled over 38 paraphrase and 14 lexical questions):

| Configuration                              | paraphrase dev | lexical dev | pooled |
| ------------------------------------------ | -------------- | ----------- | ------ |
| vector only (previous default)             | 0.879          | 0.550       | 0.791  |
| hybrid, Postgres full-text (older default) | 0.798          | 0.617       | 0.750  |
| hybrid, BM25                               | 0.913          | 0.546       | 0.814  |
| hybrid, BM25, full-text weight 0.5         | 0.901          | 0.562       | 0.810  |
| vector + citation matching                 | 0.866          | 0.738       | 0.832  |
| **hybrid, BM25 + citation matching**       | 0.900          | 0.728       | 0.854  |
| hybrid, strict AND query with fallback     | 0.811          | 0.617       | 0.759  |
| hybrid, strict AND query, weight 0.5       | 0.860          | 0.633       | 0.799  |

The finalist is BM25 plus citation matching. Held-out half:

| Configuration                    | paraphrase (37) recall@5 / MRR | lexical (14) recall@5 / MRR |
| -------------------------------- | ------------------------------ | --------------------------- |
| vector only                      | 0.946 / 0.900                  | 0.643 / 0.522               |
| hybrid, Postgres full-text       | 0.838 / 0.697                  | 0.714 / 0.677               |
| hybrid, BM25 + citation matching | 0.946 / 0.901                  | 0.786 / 0.713               |

Against vector-only, on the held-out paraphrase questions the finalist differs by MRR +0.001 (95% interval [-0.071,
+0.073]) and recall@5 +0.000, not significant, so it is not significantly worse. On the held-out lexical questions
MRR is +0.191 [+0.040, +0.373], significant, and recall@5 +0.143 [-0.143, +0.429], not significant. Both conditions
of the rule hold.

All questions (75 paraphrase, 28 lexical):

| Configuration                     | paraphrase recall@5 / MRR | lexical recall@5 / MRR |
| --------------------------------- | ------------------------- | ---------------------- |
| hybrid, BM25 + citation (default) | 0.960 / 0.900             | 0.857 / 0.720          |
| vector only                       | 0.960 / 0.889             | 0.679 / 0.536          |
| hybrid, BM25 without citation     | 0.960 / 0.907             | 0.607 / 0.538          |
| hybrid, Postgres full-text        | 0.907 / 0.748             | 0.714 / 0.647          |
| full-text only (Postgres)         | 0.627 / 0.396             | 0.536 / 0.428          |

On all lexical questions the default beats vector-only in MRR by +0.185 [+0.081, +0.304]; recall@5 by +0.179 [0.000,
+0.357]. On all paraphrase questions it is +0.011 [-0.034, +0.056], not significant.

## Decision

The default search is **hybrid with BM25 and citation matching** (full-text weight 1). Vector-only, the Postgres
full-text ranking, the strict AND query, the common-term filter and the fusion weights remain selectable options.

What the numbers say, and what they do not:

- On paraphrase questions the new default is as good as vector-only; the old Postgres hybrid was clearly worse. BM25
  repaired most of that, consistent with the rarity diagnosis.
- On lexical questions the gain comes almost entirely from citation matching. Mean reciprocal rank by style over all
  lexical questions (observational, 10 / 9 / 9 questions, not part of the decision rule): citation lookups 0.596 for
  the default against 0.080 for vector-only; exact terms 0.850 against 0.811; numbers 0.701 against 0.685. The older
  Postgres hybrid was actually better than the default on exact terms (0.883) and numbers (0.889), so BM25 is not an
  improvement on plain full-text for those; it was chosen for the pooled result, not as the best at each style.
- The lexical set is small (28, 14 held out), favors lexical matching by construction, and was written by Claude.
  A win there shows the lexical machinery works for the quoted-reference style; it is not evidence about real users'
  questions or other corpora.
- The BM25 index is built in the application from the chunk text at first use (about 4,600 chunks). This says nothing
  about large corpora and the project makes no claim of scale.

## Consequences

- The API and answer pipeline now retrieve with the new default; the first search per process builds the BM25 index.
- The CI fixture eval, with a deterministic fake embedder, scores recall@5 0.786 and MRR 0.652 in the default mode;
  its thresholds (0.7 and 0.5) still hold. It says nothing about real models.
- The reranker was measured on vector-only candidates (ADR 0003) and was not re-measured on the new default.
- Open: why the Postgres hybrid beats BM25 on exact terms and numbers (analyzed in [ADR 0005](0005-exact-terms-and-numbers.md):
  within noise on 19 questions); a lexical set not written by the same author; questions from real use.

## Limits of the evidence

- 14 held-out lexical questions give wide intervals; only large differences are detectable, and the held-out parts were
  run for three configurations.
- The development/held-out split limits tuning to the data but cannot remove an author's bias in writing questions.
- One corpus, one embedding model, local 8-bit weights.
