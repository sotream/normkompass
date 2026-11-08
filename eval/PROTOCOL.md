# Protocol: held-out question set v2 (`questions-heldout-v2`)

Status: **frozen once the questions file is committed.** Before that, only the owner changes this file, and every change is a commit.

## Why

The 75 paraphrase questions and the 28 lexical questions were written inside this project, and the system was tuned
with them in view (see README "Honest limits" and ADRs 0002 to 0005). A held-out half whose results are 17
committed files (`eval/results/*heldout*`) and that gated three decision rules is not a test set any more. This set exists to give one number that no decision in this
repository has seen.

## Rules

1. **Size.** At least 30 answerable questions. No unanswerable questions in this set (refusal is measured elsewhere).
2. **Author.** Each question is written by one of:
   - the owner or a named lawyer (`author_kind` `human` or `lawyer`), or
   - a model that is **not** a Claude model (`author_kind` `model`, exact `model` id recorded). The loader rejects
     any author whose `model` or `author` matches `claude` or `anthropic`, because this repository's code, specs and
     prompts were produced with Claude Code and the answer evaluation uses Claude.
   - **The assistant that maintains this repository does not write, edit, reword, reorder or look at these
     questions** while it changes retrieval, ranking, chunking, prompts or this protocol. Its only contact is running
     the validator (which prints question ids, never text) and, after the run, the failure list.
3. **Provenance per question** (`provenance` object, required, checked by `validateProvenance` in
   `packages/eval/src/questions.ts`): `author_kind`, `author`, `model` (models only), `written_on`, `basis`
   (`corpus-passage`, `own-knowledge` or `real-query`), `reviewed_by` (a name, or `null` if nobody checked the
   expected unit). `real-query` is only for questions taken from a real user, with consent.
4. **Expected units.** Each question names the unit id(s) that answer it, as in `eval/questions.jsonl`. The loader
   checks that they exist in the corpus. Whether the unit is the right answer is the author's claim; questions
   with a `reviewed_by` of `null` are reported as such.
5. **No overlap.** The loader rejects a question whose normalized text already occurs in `questions.jsonl`,
   `lexical-questions.jsonl` or `external-questions.jsonl`.
6. **Basis matters.** Report the share of `corpus-passage` questions next to the result: questions written while
   looking at a passage quote its words and favor lexical matching (README, external set). Prefer `own-knowledge`
   or `real-query` for at least half of the set.

## Procedure

1. The author writes `eval/questions-heldout-v2.jsonl` from `eval/questions-heldout-v2.template.jsonl`.
2. Validate: `pnpm eval:retrieval --questions eval/questions-heldout-v2.jsonl --validate-only`. Fix only format
   errors. Do not rewrite a question because it looks hard.
3. **Freeze:** commit the questions file. The commit hash is the freeze point. The retrieval and answer code at
   that commit is the system under test; `packages/` and `eval/PROTOCOL.md` are not changed between the freeze and
   the run.
4. **Run once:**
   `pnpm eval:retrieval --questions eval/questions-heldout-v2.jsonl` with the default search and the default
   embedder. The command refuses to run from a dirty tree (outside `eval/results`) and refuses to run a second time
   (it looks for an existing `*heldout-v2*` result). The result file records the commit and the SHA-256 of the
   questions file.
5. Commit the result file in its own commit. **No re-tuning afterwards.** If a defect in the code is found, fix it
   in a separate commit, say so, and report that the v2 number was measured before the fix. The v2 number is never
   re-measured to show an improvement.
6. Report, from the result file and the console output, with no selection:
   - recall@5 and MRR, with their 95% bootstrap intervals over questions (10,000 resamples, seed 1;
     `bootstrapMeanInterval`), the number of questions, and the share of questions by `basis` and `author_kind`;
   - every question whose first hit is not in the top 5, by id, question text, expected unit and rank;
   - the number of questions with `reviewed_by` `null`.
     Wilson intervals are not used: a question can have several expected units, so recall@5 is a mean of fractions, not
     a count of successes.
7. Answer-level metrics (citation validity, refusal) on this set are a separate run with the same rules and are not
   part of this protocol until written into it before the first such run.

## What this does and does not show

It shows how the default search behaves on questions written by someone other than the system's builders, once. With
about 30 questions the 95% interval is wide (a few points of difference cannot be detected), one run per system
carries no spread of its own, and no lawyer has reviewed the expected units unless `reviewed_by` says so. It does not
show quality on real users' questions or on other corpora, and it is not legal advice.
