# External question set

Questions for the retrieval eval written by other AI models from corpus text, to test the lexical results against
questions this repository's author did not choose. See `openspec/specs/retrieval-eval` for the rules.

1. `pnpm eval:external sample` writes `sample.json` (seed, units per slot) and one batch per slot in `batches/`.
   The batches are verbatim corpus text and must not be reformatted.
2. Give a model the text of `INSTRUCTIONS.md` (below the line) and one batch file, and nothing else. One batch per
   model.
3. Save its output unchanged as `raw/<slot>__<writer>.jsonl`, for example `raw/a__gemini-3.5-pro.jsonl`. The
   writer name is a label reported by the repository owner; the repository cannot verify which model wrote a file.
4. `pnpm eval:external convert` writes `../external-questions.jsonl` and `rejected.json` (every unusable line with
   its reason; nothing is dropped silently). Valid but ambiguous questions are kept with `needs_review`.
5. `pnpm eval:retrieval --questions eval/external-questions.jsonl` runs the eval and
   `pnpm eval:external report eval/results/<file>.json` prints the table per writer and overall.

The writers are models, not users. The set can strengthen or weaken confidence in the lexical results; it does
not choose the default search.
