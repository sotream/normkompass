# 0003. Tuning hybrid search and the default search mode

- Status: Accepted
- Date: 2026-11-03

> **Update (2026-11-04):** the default decided here was later replaced; see [ADR 0004](0004-lexical-retrieval.md).
> The measurements below stand as made.

## Context

[ADR 0002](0002-embeddings-and-reranker.md) found that vector-only search scored significantly better than
the hybrid default (MRR 0.879 versus 0.742) and that the full-text side alone was weak (MRR 0.384). The brief
asks for hybrid search, so the full-text side and the fusion were tuned before deciding anything. Before tuning,
the seven questions flagged `needs_review` were checked against the corpus text.

## Eval set review

The review was done in the same process that wrote the questions (Claude), so it is not independent, and all seven questions keep
their `needs_review` flag. Three questions were reworded:

- **q027** asked for the deadline to apply for the refund of input VAT after the end of the calendar year. Two
  norms answer it differently: § 61 Abs. 2 UStDV (nine months, businesses established in another EU member
  state) and § 61a Abs. 2 UStDV (six months, businesses established outside the EU). The question now names
  the EU case, so only § 61 answers it.
- **q006** spoke of exempting imports from tax; § 5 Abs. 3 UStG lets the ministry order that import turnover tax
  is refunded or waived. The question now says that.
- **q017** asked when a marketplace operator is not liable; § 25e Abs. 2 and Abs. 4 UStG both speak about
  liability. The question now names the condition of Abs. 2 (the tax is that of the supplying business).

The other four (q005, q022, q050, q056) were read against their expected unit and left unchanged. An automatic
ambiguity check was tried (questions whose content words all occur in another, unrelated unit) and dropped: it
missed q027 and flagged 18 questions, most of them harmless.

Effect: the numbers moved slightly (the default hybrid went from recall@5 0.880 and MRR 0.742 to 0.907 and
0.748). The conclusions of ADR 0002 hold on the corrected set: no embedding model is significantly better than
multilingual-e5-small (differences in MRR -0.012, +0.020 and -0.002, all intervals contain zero), vector-only
still beats hybrid, and full-text alone is far behind. All tables in the README use the corrected set.

## Decision rule

Fixed before the runs (the rule is in the merged change `tune-hybrid-search`, the parameter values were chosen
before the first run):

- The questions are split by the parity of the question number: odd numbers are the development half (38
  questions), even numbers the held-out half (37). Variants are compared on the development half only.
- Five variants were declared: full-text weight 0.5, weight 0.25, a stricter full-text query that drops terms
  occurring in more than 2 percent of the chunks, that filter with weight 0.5, and weight 0.01 (the full-text
  ranking only breaks ties). The default hybrid (weight 1) and vector-only were measured as references.
- The variant with the best MRR on the development half is the candidate. It becomes the default only if on the
  held-out half it is not significantly worse than vector-only (95% paired bootstrap). If it ties with vector-only,
  the simpler one is chosen. Otherwise the default is vector-only.

## Results

Development half (38 questions), multilingual-e5-small:

| Configuration                        | recall@5 | MRR   |
| ------------------------------------ | -------- | ----- |
| hybrid, weight 1 (previous default)  | 0.974    | 0.798 |
| vector only                          | 0.974    | 0.879 |
| weight 0.5                           | 0.974    | 0.860 |
| weight 0.25                          | 0.974    | 0.877 |
| common-term filter 2%                | 0.947    | 0.800 |
| common-term filter 2%, weight 0.5    | 0.947    | 0.842 |
| weight 0.01 (full-text as tie-break) | 0.974    | 0.879 |

The best variant is weight 0.01, tied with vector-only. Held-out half (37 questions):

| Configuration                       | recall@5 | MRR   |
| ----------------------------------- | -------- | ----- |
| hybrid, weight 1 (previous default) | 0.838    | 0.697 |
| vector only                         | 0.946    | 0.900 |
| weight 0.01                         | 0.946    | 0.900 |

Vector-only beats the previous hybrid default on the held-out half significantly (MRR +0.203, interval
[+0.091, +0.321]; recall@5 +0.108, [+0.027, +0.216]). Weight 0.01 is identical to vector-only (difference 0.000).
All 75 questions: vector-only MRR 0.889 versus 0.748 for hybrid (+0.141, [+0.071, +0.215]).

## Reranker on the new default

With vector-only as the default, the reranker (bge-reranker-v2-m3 over the top 20) was run again on the
corrected set: recall@5 0.987 and MRR 0.958 against 0.960 and 0.889 without it. MRR improves significantly
(+0.068, [+0.021, +0.121]); recall@5 improves by 0.027 but its interval ([0.000, +0.067]) touches zero, so that
part is not significant. It stays off by default and is not wired into the API: the first run took about 53
seconds per question on an Apple M1 and the time was not measured again.

## Decision

The default search mode is **vector-only**. No hybrid variant was measurably better than vector-only, and the one
that matched it does so by making the full-text ranking irrelevant, so the simpler configuration wins the tie.
Hybrid (vector plus full-text, merged by weighted RRF) and full-text only stay available as explicit modes, and
the fusion weight and the common-term filter are explicit options. The class keeps the name `HybridSearch`.

What this does not show: that full-text search is useless in general. The full-text side here ORs the question
words and ranks with `ts_rank_cd`; why it hurts was not analyzed, and any explanation is a guess. The questions
were written from the law text in paraphrase, which favors embeddings; questions that quote exact terms or
citations (for example "§ 14 Abs. 1") might favor full-text. That was not tested.

## Consequences

- The API and the answer pipeline now retrieve with vector-only search by default; the README says so and
  records the project brief's "hybrid" as not supported by the measurements on this question set.
- The CI eval on fixtures uses a deterministic fake embedder; there the default scores recall@5 0.786 and MRR 0.649
  (hybrid scored 0.857 and 0.665), so the thresholds (0.7 and 0.5) still hold. This says nothing about real models.
- Follow-up candidates: analyze the full-text failures (for example a stricter or phrase-aware query); questions that
  quote exact terms; a reranker setup that is fast enough to use.

## Limits of the evidence

- 38 and 37 questions per half give wide intervals; only large differences are detectable.
- The held-out half was run for three configurations (the default hybrid, vector-only, and the winner), so it is
  lightly reused; no further tuning on it is claimed.
- One corpus, one embedding model, questions written by Claude and reviewed by the owner, the same model that wrote the system.
