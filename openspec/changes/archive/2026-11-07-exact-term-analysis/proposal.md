## Why

On the lexical questions the older hybrid (Postgres full-text) scored higher than the current default (BM25 with citation matching) for exact terms (0.883 against 0.850) and numbers (0.889 against 0.701), while the default is far better on citation lookups (ADR 0004). The reason was never analyzed, so it is unknown whether BM25 is mis-tokenizing numbers and terms (a fixable defect) or whether the difference is noise on a small set (19 questions of these two styles).

## What Changes

- Analyze, per exact-term and number question, where each of the two rankings places the expected unit and which units BM25 ranks above it, and write down what the analysis shows.
- State candidate causes as hypotheses and test each with a measurement that could prove it wrong (for example how numbers such as "6.000" and "§ 18" are split into words, whether common words outweigh the rare term, whether the older ranking's phrase proximity matters).
- Try at most a short, fixed list of changes to the BM25 ranking that follow from confirmed causes, behind explicit options, measured on the development halves and decided by a rule written before the runs; keep the default unless the rule is met.
- Record the findings in an ADR either way, including that the set is small and that a difference may be noise.

Out of scope: new embedding models, generation, a different corpus, any claim that the findings hold for other corpora.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `hybrid-search`: the gap on exact terms and numbers is analyzed, and any adopted change is explicit and tested.
- `retrieval-eval`: the decision about the default for this gap follows a rule fixed before the runs.

## Impact

- An analysis command or an extension of the existing diagnosis; possibly new search options with tests; no change to the default unless the rule is met.
- ADR 0005 and a README update of the results and "Honest limits".
