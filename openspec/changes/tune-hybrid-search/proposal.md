## Why

The phase 5 eval showed that vector-only search (MRR 0.879) is significantly better than the hybrid default
(MRR 0.742) on the demo corpus, and that the full-text side alone is weak (MRR 0.384). A hybrid mode that makes
retrieval worse than one of its own components is a defect of the full-text side or of the fusion, and the
project brief asks for hybrid search. Before tuning, the eval set itself needs a review: two of the seven
questions flagged `needs_review` have a wrong or ambiguous expected answer (for example one question is
answered by two different norms with different deadlines), and tuning against flawed questions would be
tuning against noise.

## What Changes

- Review the seven `needs_review` questions against the corpus text: reword or re-target the ones that are ambiguous or inexact, keep the flag on any that remain doubtful, and re-measure the existing configurations on the corrected set.
- Try a small, fixed list of changes to the full-text side and to the fusion (for example a weaker weight for the full-text ranking, a stricter full-text query), measured on a development half of the questions only.
- Decide with a rule that is written down before the numbers are read, and report the result on a held-out half that was not used for tuning.
- Keep hybrid as the default only if it is not significantly worse than vector-only on the held-out half; otherwise record the finding and make the best measured configuration the default, with the reasoning in an ADR.

Out of scope: new embedding models, the reranker, generation, new questions beyond the corrections.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `hybrid-search`: the default configuration must not rank worse than its own vector component, and any fusion weighting is explicit and tested.
- `retrieval-eval`: questions must have an unambiguous expected answer, and tuning must be reported on held-out questions.

## Impact

- Possible change of the default search behavior (an explicit, measured decision).
- Corrected `eval/questions.jsonl` and re-run results; the README tables and ADR 0002 are updated with the corrected baseline, and the old numbers stay in the result files with their dates.
- No new dependencies.
