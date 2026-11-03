## 1. Eval set review

- [ ] 1.1 Review the seven `needs_review` questions against the corpus text and reword the inexact or ambiguous ones (an automatic ambiguity check was tried and dropped: it missed the one real ambiguity and flagged many harmless questions)
- [ ] 1.2 Re-run the existing configurations on the corrected set and update the README table and ADR 0002 baseline

## 2. Tuning

- [ ] 2.1 Add a deterministic development/held-out split to the retrieval eval and report both halves
- [ ] 2.2 Implement the candidate variants behind explicit search options, with tests
- [ ] 2.3 Run all variants on the development half, apply the stated decision rule, and run the held-out half for the winner and for vector-only

## 3. Decision and docs

- [ ] 3.1 Set the default according to the rule; write ADR 0003 with all numbers and the reasoning
- [ ] 3.2 Update the README results and "Honest limits"
- [ ] 3.3 Run `openspec archive tune-hybrid-search` and keep the Purpose sections filled
