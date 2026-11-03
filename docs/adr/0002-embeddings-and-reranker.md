# 0002. Embedding model and reranker

- Status: Accepted
- Date: 2026-11-03

## Context

Phase 3 measured one embedding model (multilingual-e5-small) and nothing else, so no claim about
the choice was supported. This ADR compares four local models on the same questions, measures what
search mode and a reranker contribute, and records the decision. All numbers are in the README
("Retrieval results"); the raw files are in `eval/results/`.

Setup for every run: the same 75 answerable questions of `eval/questions.jsonl`, the same hit definition
(the expected unit or its parent), recall@5 and MRR (first hit within the top 10), 8-bit quantized weights
run locally through transformers.js, one Postgres index per model, hybrid search with RRF unless stated.

## Decision rule

The rule was written in the change proposal before any of these runs: choose the model with the best
MRR; if two models differ by less than the noise one can expect from 75 questions, choose the smaller and
cheaper one and say so. A reranker is adopted only if it improves both recall@5 and MRR.

One thing must be said plainly: "less than the noise" was left open then. The method (a 95% paired
bootstrap over the questions, `pnpm eval:compare`) was added after the four hybrid numbers were already
known, so it is not a pre-registered test. It is deterministic and it is the measure used below: a
difference counts only if its interval excludes zero.

## Results

Hybrid search, 75 questions. Differences are against multilingual-e5-small, 95% paired bootstrap.

| Model                 | recall@5 | MRR   | MRR difference         | Index time | Weights |
| --------------------- | -------- | ----- | ---------------------- | ---------- | ------- |
| multilingual-e5-small | 0.880    | 0.742 | -                      | 229 s      | 118 MB  |
| multilingual-e5-base  | 0.907    | 0.736 | -0.007 [-0.050, 0.037] | 364 s      | 279 MB  |
| multilingual-e5-large | 0.907    | 0.768 | +0.025 [-0.023, 0.074] | 5246 s     | 562 MB  |
| bge-m3                | 0.880    | 0.744 | +0.002 [-0.046, 0.048] | 16719 s    | 570 MB  |

No difference is significant, for MRR or for recall@5. Index times were measured on a laptop (Apple M1,
16 GB) that was not otherwise idle; the same small model took 1141 s in one run and 229 s in another, so the
times show an order of magnitude and not a precise ranking.

Ablation and reranker on multilingual-e5-small (difference against hybrid):

| Configuration                 | recall@5 | MRR   | MRR difference          | recall@5 difference     |
| ----------------------------- | -------- | ----- | ----------------------- | ----------------------- |
| hybrid (default)              | 0.880    | 0.742 | -                       | -                       |
| vector only                   | 0.960    | 0.879 | +0.137 [+0.070, +0.207] | +0.080 [+0.027, 0.147]  |
| full-text only                | 0.613    | 0.384 | -0.358 [-0.433, -0.284] | -0.267 [-0.373, -0.160] |
| hybrid, no compound splitting | 0.880    | 0.742 | 0.000                   | 0.000                   |
| hybrid + reranker (top 20)    | 0.987    | 0.950 | +0.208 [+0.140, +0.282] | +0.107 [+0.040, 0.187]  |

## Decision

1. **Embedding model: multilingual-e5-small.** No larger model is measurably better on this question set,
   so the tie-breaking rule applies and the smallest, cheapest model is kept. This is not a finding that
   the models are equally good in general, only that this evidence cannot separate them.
2. **Reranker: meets the adoption rule, stays off by default.** bge-reranker-v2-m3 over the top 20
   candidates improves both recall@5 and MRR significantly. On this CPU the 75-question run took about
   66 minutes, roughly 53 seconds per question, which is not usable for an interactive answer. It is
   therefore available for evaluation (`--rerank`) but not wired into the API or the answer pipeline. A
   faster setup (a GPU, or a smaller reranker) is a separate piece of work that this ADR does not claim to
   have tested.
3. **Search mode: the default stays hybrid for now, and this is a known weak spot.** Vector-only search
   beat hybrid significantly (MRR +0.137). The full-text ranking in this implementation (question words
   OR-ed together, ranked by `ts_rank_cd`) is weak on its own (MRR 0.384) and, merged by RRF, pulls the
   ranking down. The hybrid default is what the project brief asks for and changing it is a behavior
   change that needs its own specification, so it is recorded here as a follow-up: tune or replace the
   full-text side, or weight it lower, and re-measure.
4. **Compound splitting: no evidence either way.** Splitting changed the query terms of only 1 of the
   75 questions, so this eval cannot show whether it helps. The questions were written from the law text
   and contain almost no compound words.

## Alternatives considered

- **multilingual-e5-base, multilingual-e5-large, bge-m3:** evaluated, not significantly better; large is
  about 20 times slower to index than small and bge-m3 about 70 times slower in these runs.
- **Cloud embedding models (OpenAI text-embedding-3, Voyage multilingual):** **not evaluated**, because
  no API key was provided. No quality figure is attributed to them.
- **Making vector-only the default:** supported by the numbers, but out of scope for this change (see 3).

## Local versus cloud

Local models keep documents on the machine, cost nothing per request, and need no account; their price is
indexing time and memory, which the table shows (about four minutes for small up to about four and a half
hours for bge-m3 on this laptop). Cloud embedding services would remove the indexing time from the laptop
but send the corpus to a third party and add a per-token cost. For public law the privacy argument is weak;
for private documents it would be strong. Since no cloud model was run, this ADR makes no claim about
which would retrieve better.

## Limits of the evidence

- 75 questions, written by the author from the corpus text; the wording is often close to the law, which
  can favor any method that matches on similar words. Seven questions are flagged `needs_review` and have
  not been reviewed by a second person.
- One corpus (five German federal laws) and one language; nothing here transfers to other documents
  without a new run.
- Intervals are wide: with 75 questions a real difference of a few points cannot be detected, which is
  why four different models cannot be told apart.
- Quantized weights were used, not the full-precision models.
- Index times come from a single run each on a shared laptop.
- The reranker was run once, with hybrid candidates; reranking vector-only candidates was not tried.

## Consequences

- The default embedding model stays multilingual-e5-small.
- The README states that hybrid is currently worse than vector-only on this eval.
- Follow-up candidates, in order of expected value: improve or reweight the full-text side of hybrid
  search; a faster reranker setup; a question set with compound words and cloud embedding models, if keys
  become available.
