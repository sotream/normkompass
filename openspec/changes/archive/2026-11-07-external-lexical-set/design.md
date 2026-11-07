## Context

Each writer receives only corpus text and an instruction, not the system, not the existing questions and not the results. The writers are models whose names the repository owner reports; the repository cannot verify which model produced a file, so the writer name is a label given by the owner.

## Decisions

- **Reproducible sampling.** Units are sampled with a recorded seed and stratified by law, so every law is represented and the sample can be regenerated. Each writer gets a different batch to avoid duplicates.
- **Instruction kept in the repository**, so a reader can see exactly what the writers were asked, including the question styles (exact term, number, citation lookup) and the required output format.
- **Raw output stored unchanged**, then converted by a script, so the conversion is auditable.
- **Validation before use.** Expected unit exists, style is allowed, the question is not a copy of an existing question, the question is answerable from the given unit; doubtful items are flagged `needs_review`, not silently dropped.
- **Separate and labeled.** Results are reported per writer and overall in their own table, never averaged with the other sets, and not used for choosing the default.
- **Honest limit.** Other models are not users, may share biases with the system's author, and the batches are small, so the set can strengthen or weaken confidence but cannot prove quality.

## Risks

- A writer may produce questions that repeat the unit's wording, which favors lexical matching. The styles and the labeling say so.
- Sample sizes per writer are small; per-writer rows show spread, not rankings.
