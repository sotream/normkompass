## Decisions

- **Review first, tune second.** The corrections to the questions are made before any tuning, and all
  existing configurations are re-measured on the corrected set, so that the starting point is honest. Each
  correction is justified by quoting the corpus text it rests on. Questions that stay doubtful keep `needs_review`;
  this review is by the same author as the questions and is not an independent one, and the README says so.
- **Development and held-out split.** The answerable questions are split deterministically (by the
  parity of the question number). Tuning uses the development half only; the held-out half is run once per
  final candidate. This limits, but does not remove, the risk of tuning to 75 questions.
- **A fixed, short list of candidates, all reported.** At most five variants are tried (for example full-text
  weight 0.25 and 0.5 in the fusion, a stricter full-text query that drops very common words, full-text used
  only to break ties). Every variant's numbers are published, including those that did not help.
- **Decision rule, stated before the runs.** Pick the variant with the best MRR on the development half. Adopt
  it as the default only if, on the held-out half, a paired bootstrap shows it is not significantly worse than
  vector-only; if several variants tie within noise, prefer the simpler one. If no variant meets that, the
  default becomes vector-only and the full-text side stays available as an explicit mode, with the finding recorded.
- **Honesty about the outcome.** If hybrid cannot beat vector-only here, that is a result about this corpus and
  question set, not a general statement about hybrid search, and the documents say so.

## Risks

- 37 or 38 questions per half give wide intervals; only large differences are detectable.
- The questions were written from the law text, which may favor semantic matching over keyword matching.
