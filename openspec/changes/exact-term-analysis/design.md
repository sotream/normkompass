## Context

The default merges vector, BM25 and citation matching with weighted RRF. The older hybrid merged vector with Postgres full-text. On the lexical set the older one is higher on exact terms and numbers (10 and 9 questions) and clearly lower on citation lookups. The paired intervals on these small subsets were not computed for this comparison.

## Decisions

- **Look before changing.** The first deliverable is a per-question account (ranks under both rankings and what outranks the expected unit), reusing the existing diagnosis tooling where it fits.
- **Hypotheses are labeled and tested.** Each candidate cause is written down with the measurement that would refute it. An untested explanation stays marked as a hypothesis in the documentation.
- **A short fixed list of candidate changes**, each following from a confirmed cause, each behind an option, so no search is tuned until it looks good.
- **Decision rule before the runs.** A candidate becomes the default only if, on the development halves, it improves exact-term and number questions without being worse on the paraphrase and citation questions, and the improvement holds on the held-out halves, with paired bootstrap intervals reported. Point estimates on 19 questions are not enough on their own; the ADR says so either way.
- **Noise is a valid finding.** If the paired intervals include zero, the ADR says the gap cannot be told from noise and nothing changes.

## Risks

- The subsets are small (about 10 and 9 questions): a real effect can be missed and a chance effect can look real.
- Questions were written by the same author as the system; the external set (a separate change) reduces this.
