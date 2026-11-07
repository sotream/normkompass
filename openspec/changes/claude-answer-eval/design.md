## Context

Both runs used the pipeline defaults (hybrid search, 8 retrieved passages, the shipped prompt) with `ANSWER_PROVIDER=claude`. Each ran once, so there is no measure of spread; the Gemini rows show that one model can vary noticeably between runs.

## Decisions

- **Report, do not rank.** Differences of one question out of 72 (cites expected norm 0.986 vs 0.972) are noise at one run each; the text says so and the chart carries the same note as for the other models.
- **Cost is reported as measured.** The cost comes from the organization's usage page before and after each run (Opus 5.5 $2.23, Sonnet 5.5 $0.88), not from a token count of the pipeline, which does not expose usage. Prices change, so the README gives the date.
- **Refusals analyzed.** Both models refused the same three answerable questions (q027, q030, q044). Retrieval was re-run for them: the expected unit was missing from the top 8 for q030 and q044 and was at rank 1 for q027. That is stated as found; why q027 was refused is not claimed.
- **Same refusal reasons.** Both runs have 17 refusals, all `model-refused`; no `citation-rejected`, no model errors.
- **Chart.** The chart definitions list the new files as two more groups; the committed-chart test keeps the SVG in sync.

## Risks

- A reader may take two runs as a ranking of Opus and Sonnet. The README and the chart note say what they do not show.
- The question set is small and written by the project author; the three shared refusals are 4% of the answerable questions.
