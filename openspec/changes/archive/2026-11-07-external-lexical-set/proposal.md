## Why

The lexical question set was written by the same author as the system, so it may be shaped by how the system works. A set written by other models, from text they are given and without seeing the system or our questions, is a cheap way to test the lexical results against questions the authors of this repository did not choose. It is still not real users, and the documentation must say so.

## What Changes

- Generate reproducible samples of corpus units (a recorded seed, split into one batch per writer) and keep the instruction text given to the writers in the repository.
- Accept question files written by other AI models from those batches, store their raw output unchanged, and convert them into a separate question set where every question names its writer and carries `origin: external`.
- Validate the external set (structure, expected units exist, no question copied from the existing sets) and flag doubtful items for review.
- Run the retrieval eval on the external set and report it separately, per writer and overall, never averaged with the other sets and not used to choose the default.
- State what the set does and does not show.

Out of scope: changing the default search, collecting real user questions, any claim that other models' questions represent users.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `retrieval-eval`: an externally written question set, validated and reported separately.

## Impact

- A sampling command, a conversion and validation step, new question files under `eval/`, new result files, README and ADR updates; no change to search or answer code.
