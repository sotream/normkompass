# 0005. Exact terms and numbers: why the older hybrid scored higher, and a decision rule

- Status: Accepted
- Date: 2026-11-07

## Context

[ADR 0004](0004-lexical-retrieval.md) made BM25 with citation matching the default. On the 28 lexical questions
the older hybrid (Postgres full-text) scored higher for exact terms (0.883 against 0.850 MRR) and numbers (0.889
against 0.701), and the reason was not analyzed. This ADR records the analysis, the candidate changes and the
rule for deciding about them. The rule was written before any candidate was run (it is in the commit that
precedes the candidate runs).

## Analysis

`pnpm eval:exact-terms` compares, for the 19 exact-term and number questions of the lexical set, the default
(hybrid, BM25, citation matching) with the older hybrid (full-text, no citation matching), and reads the rank of
the expected unit inside each component list. Result file: `eval/results/exact-terms-2026-11-07.json`.

| Subset      | questions | equal | older better | default better | MRR, older minus default (95% paired bootstrap) |
| ----------- | --------- | ----- | ------------ | -------------- | ----------------------------------------------- |
| all         | 19        | 15    | 3            | 1              | +0.107 [-0.009, +0.247], not significant        |
| exact terms | 10        | 8     | 1            | 1              | +0.033 [-0.050, +0.150], not significant        |
| numbers     | 9         | 7     | 2            | 0              | +0.188 [0.000, +0.466], not significant         |

The recall@5 differences are +0.105 for all (interval [0.000, +0.263]) and +0.222 for numbers (interval [0.000,
+0.556]); neither is significant. The gap is carried by three questions: l008 ("600 000 Euro") and l026
("15 000 Euro"), both numbers with a long expected unit, and l010 ("Steuerstemplern"), where BM25 puts the
child item above the expected Absatz and the child does not count as a hit. In the fourth question that differs,
l028, the default is better. Fifteen of 19 questions are identical under both.

## Hypotheses and what the data say

Each hypothesis was written with a measurement that could refute it.

1. **The query loses the quoted words (tokenization).** Refuted for these questions: for none of the 19 do the
   index words of the quoted terms get lost in the query or miss in the expected unit. The questions write
   thousands as "600 000", which survives. **A related defect is confirmed but unmeasured by the set:** numbers
   written with a separator ("6.000", "1.550") are one word in the document index but are split into "6" and
   "000" in the query, so they cannot match. 47 of 64 distinct such numbers in the corpus are affected, in 85 of
   4,425 units; none of the 19 questions contains one, so this defect does not explain the gap and its effect on
   retrieval is not measured.
2. **BM25's length normalization penalizes long units.** Not refuted, not confirmed. The two number questions
   where the older ranking wins have the two longest expected units (1,385 and 1,355 characters of a range of 201
   to 1,385), and across the 19 questions the Spearman correlation between the length of the expected unit and
   how much worse BM25 ranks it than full-text is +0.44. With 19 questions that is suggestive, not evidence.
3. **Fusion amplifies small differences.** Supported for l008: the lexical rank of the expected unit is 20 under
   BM25 and 17 under full-text, vector rank is 3, and the fused rank is 7 against 1. The lexical lists differ
   little there; the fused ranking changes a lot. This says the three-question gap is fragile, not that either
   lexical ranking is better.
4. **The gap is noise.** Not excluded: every paired interval includes zero or touches it, and 15 of 19 questions
   are equal.

## Candidates and decision rule (fixed before the candidate runs)

Candidates, nothing else will be tried:

- **C1: BM25 length normalization** `b` = 0.5 and `b` = 0.25 (default 0.75), as the option `bm25B`.
- **C2: keep separated numbers whole in the query** ("6.000" stays one term), as an option.

The runs use the same development and held-out halves as ADR 0004 (odd and even question numbers) on the
paraphrase set (75 questions) and the lexical set (28 questions).

**C1 becomes the default only if all of these hold:**

1. On the development halves, MRR on the paraphrase set is not more than 0.01 below the default, and MRR on the
   whole lexical set is above the default.
2. The same two conditions hold on the held-out halves.
3. On the 19 exact-term and number questions, the paired bootstrap interval of the MRR difference (candidate
   minus default) lies entirely above zero.
4. No question style of the lexical set (term, number, citation) loses more than 0.05 MRR.

**C2 becomes the default only if** a fixture test shows that a number with a separator now matches, and no MRR
on any of the four halves (paraphrase and lexical, development and held-out) is lower than the default's. The
set contains no such question, so C2 can only be justified by the demonstrated mismatch, not by a measured gain.

If a candidate fails the rule it stays an option and the result is recorded; a difference whose interval
includes zero is not described as an improvement.

## Results and decision

MRR per half; "default" is the search before this ADR changed anything. Result files are in `eval/results/`
(`2026-11-07-multilingual-e5-small-{b0.5,b0.25,keepnum}-{dev,heldout}[-lexical].json` and the default
`...-{dev,heldout}[-lexical].json`), all measured at commit `01640f3`.

| Variant                   | paraphrase dev (38) | lexical dev (14) | paraphrase held-out (37) | lexical held-out (14) |
| ------------------------- | ------------------- | ---------------- | ------------------------ | --------------------- |
| default                   | 0.900               | 0.728            | 0.901                    | 0.713                 |
| C1 `b` = 0.5              | 0.908               | 0.728            | 0.928                    | 0.756                 |
| C1 `b` = 0.25             | 0.904               | 0.730            | 0.906                    | 0.764                 |
| C2 separated numbers kept | 0.900               | 0.728            | 0.901                    | 0.713                 |

**C1 is not adopted.**

- `b` = 0.5 fails condition 1: its MRR on the lexical development half equals the default's (0.728), it is not
  above it. Condition 3 fails too (see below).
- `b` = 0.25 meets conditions 1, 2 and 4. On the paraphrase set it is not below the default on either half; on the
  lexical set it is above on both halves; by style (all 28 lexical questions) terms change by -0.017, numbers by
  +0.043 and citations by +0.059. It fails condition 3: on the 19 exact-term and number questions the paired
  bootstrap difference in MRR is +0.012 with an interval of [-0.025, +0.058], and in recall@5 +0.105 with an
  interval of [0.000, +0.263]. Neither excludes zero, so the difference cannot be told from noise.
- For `b` = 0.5 the interval of the MRR difference on those 19 questions is [0.000, +0.017] (+0.006).

C1 stays available as the option `bm25B` (`pnpm eval:retrieval --bm25-b 0.25`). The lexical set as a whole scores
a little higher with it (0.720 to 0.747 MRR at `b` = 0.25), but that rise comes mostly from the citation
questions, which this rule did not target, and no interval was computed for it, so it is not claimed as an
improvement.

**C2 is adopted as the default.** It changed no question on any of the four halves (identical MRR and recall to
the default), and the fixture test and the Postgres integration test show that a number with a separator now
finds its unit and that the older full-text query accepts such numbers without failing (checked on the 64
separated numbers of the corpus plus five extra forms). No eval question contains such a number, so its effect on
real questions is **not measured**; the justification is the demonstrated mismatch, as the rule stated.

## Consequences

- The earlier statement that the older hybrid is better on exact terms and numbers is revised: it rests on three
  questions of 19, with paired intervals that include zero, and is not evidence that BM25 is worse. The cause that
  best fits is length normalization (hypothesis 2), which is suggestive only.
- The default search is unchanged except that numbers with a separator are kept whole in the query.
- Open: how often separated numbers occur in real questions and how much C2 helps; whether the external question
  set (a separate change) contains any; and a larger set of exact-term questions, since 19 cannot settle the
  length-normalization question.
