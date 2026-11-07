## Why

The README states that Claude has not been measured, and the answer-evaluation chart is titled "models other than Claude". Two full runs with Claude now exist (Opus 5.5 and Sonnet 5.5, 89 questions each), so that statement is out of date and the numbers should be recorded and reported with their limits instead of staying only on a laptop.

## What Changes

- Record the two result files from `pnpm eval:answers` (one run per model, commit `327de90`, 2026-11-07) in `eval/results/`.
- Report them in the README next to the other answer-evaluation rows, with date, commit, model id, the real cost of each run, and the refusal reasons.
- Analyze the three answerable questions that both models refused and say what is known about them: for two of them the expected unit was not among the eight retrieved passages, for one it was at rank 1 and the cause is not established.
- Add the Claude runs to the answer-evaluation chart and retitle it, keeping the existing models.
- Replace the README limit "Claude has not been measured" with an accurate one: one run per model, questions written by the project author, no repetition to show the spread, no comparison to a ranking.

Out of scope: new code in the answer pipeline, changing prompts or the number of sources, running Claude on the lexical or external question sets, repeated runs to measure spread, and any claim that one model is better than another.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `answer-eval`: recorded real-model runs are reported with model id, date, commit and cost; the refusals of answerable questions are analyzed, not only counted.
- `results-charts`: the answer chart shows every recorded model and its title does not claim a model is missing.
- `project-docs`: the limits section describes what the Claude runs do and do not show.

## Impact

- Two new JSON files under `eval/results/`, a change to the chart definitions and the regenerated chart, README text. No change to search, answer or API code.
- The runs used a project-held API key and promotional credits; the key is not stored in the repository.
