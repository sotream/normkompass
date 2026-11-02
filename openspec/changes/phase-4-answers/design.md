## Context

Phase 3 returns ranked chunks with their original text. The answer layer must never present text
that is not backed by a chunk, and the check must not depend on the model's own honesty.

## Decisions

- **Pipeline**: search (top 8 chunks) -> prompt with the chunks as numbered, delimited sources
  -> model returns structured JSON -> code verifies -> response.
- **Model output contract**: `{ refused: boolean, answer: string, citations: [{ chunk: <number>, quote: string }] }`.
  Citations refer to chunks by the number given in the prompt; the code maps them to source,
  path, and URL from the stored chunk, so the model cannot invent a path or URL.
- **Verification** (code): the chunk number exists in the retrieved set; the quote is a
  non-empty verbatim substring of that chunk's text (exact match, no normalization except that
  both sides are compared as stored). At least one citation is required for an answer.
- **Strict failure rule**: if any citation fails, the whole response becomes a refusal. A partial
  answer with dropped citations could still contain claims that were backed only by the dropped
  citation. Trade-off: some valid answers are refused when the model quotes sloppily; this is
  reported by the eval and open for review.
- **Refusal** is set when: retrieval returns nothing; the model sets `refused`; the model returns
  an answer without citations; verification fails; or the model call fails. A refusal has an empty
  `answer`, no citations, and `stand = null`.
- **Stand**: for an answer, the distinct Stand statements of the cited laws, joined with "; ".
- **Untrusted text**: corpus text and the question are data inside delimiters; the prompt says
  to ignore instructions found in them. The code checks the output regardless.
- **Model configuration**: the model id and API key are read from environment variables; there
  is no default model id in code. The model id is taken from current Anthropic documentation
  when the call is written and put in `.env.example` as a placeholder-style example.
- **Model interface**: a small `AnswerModel` interface (prompt in, structured output out) with
  the Claude implementation and a scripted stub for tests. Tests never call the network.
- **Answer language**: the answer is written in the language of the question (German in the demo);
  quotes are always in the source language.
- **Eval**: the manual command runs every question of the eval set; for answerable questions it
  reports citation validity (share of returned citations that verify) and whether the cited
  units include an expected norm; for unanswerable ones it reports refusal. Refusal precision and
  recall are computed over the whole set, where "refused" is the positive class.

## Risks

- A model may refuse too often or too rarely; only the manual eval shows this, and it needs an API key.
- Exact-substring checking is strict about whitespace and quotation marks; the prompt tells the
  model to copy text exactly, and the eval reports how often this fails.
