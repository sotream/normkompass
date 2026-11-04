## 1. Diagnosis

- [ ] 1.1 Add an analysis command that reports, per answerable question, the ranks of the expected unit under vector and full-text ranking and the units that outrank it under full-text
- [ ] 1.2 Run it, write down the findings in the README and in the ADR, including the number of questions only full-text solves

## 2. Lexical question set

- [ ] 2.1 Write the lexical questions from the corpus text, validate them against the corpus, flag doubtful ones `needs_review`, and report them separately
- [ ] 2.2 Let the eval run both sets with the development and held-out split and record which set a result is for

## 3. Candidates and decision

- [ ] 3.1 Implement the candidate lexical rankings behind explicit search options, with tests
- [ ] 3.2 Run all candidates on the development parts, apply the stated rule, run the held-out parts for the winner and for vector-only
- [ ] 3.3 Set the default according to the rule and write ADR 0004 with all numbers
- [ ] 3.4 Update the README results and "Honest limits"
- [ ] 3.5 Run `openspec archive lexical-retrieval` and keep the Purpose sections filled
