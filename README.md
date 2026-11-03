# normkompass

RAG with verifiable citations for regulated documents (TypeScript).
Demo corpus: German federal law (gesetze-im-internet.de).

The goal: answer questions over a document set and always point to the exact
passage (for example "§ 14 Abs. 1 UStG"). If the corpus does not support an
answer, the service refuses instead of guessing.

## Status

Reference implementation, all planned v1 phases implemented: project scaffold, corpus ingest with a
structure-aware parser for the demo laws, hybrid search with a retrieval evaluation and an embedding
comparison (ADR 0002), and answer generation with code-checked citations and refusal. It is not a finished
product. See "Honest limits" for what is not known or not done, in particular that Claude itself has not
been measured and that hybrid search currently scores below vector-only search on the eval.

## How this was built

The code, specs and documents in this repository were written by Claude (Anthropic's model, used through
Claude Code), directed by the repository owner with a human in the loop. Work follows
[OpenSpec](https://github.com/Fission-AI/OpenSpec): every change started as a spec pull request that the
owner read and merged before any implementation existed, and the implementation arrived as a separate pull
request that the owner merged after review. The owner set the goals, the constraints and the acceptance
criteria and decided at each gate. Commits are made under the owner's account.

If you want to judge the engineering and the product thinking rather than take this page's word for it, these
are the places where it is visible and checkable:

- **Specs before code.** `openspec/changes/archive/` holds every proposal, design and task list, and
  `openspec/specs/` the resulting behavior. The pull request history shows the spec-then-implementation order.
- **Decisions with stated rules.** [ADR 0001](docs/adr/0001-corpus-and-licensing.md) (what may be
  processed, with cited sources) and [ADR 0002](docs/adr/0002-embeddings-and-reranker.md) (the decision rule
  and where it was and was not fixed before the numbers were seen).
- **Results that are not flattering are kept.** The tables show a weak local model, hybrid search scoring
  below vector-only search, and a reranker that is too slow to use; "Honest limits" lists what is unknown.
- **A strict product rule enforced in code.** An answer needs a citation whose quote is a verbatim substring of
  the retrieved text; any failed citation turns the whole answer into a refusal.
- **Scope.** What was deliberately left out (no UI, no auth, no promise of current law) is stated, not
  hidden.

## Not legal advice

Output of this project is not legal advice and makes no promise that the law
shown is current or complete.

## Quick start

Requirements: Node 24, pnpm, Docker.

```sh
pnpm install
cp .env.example .env   # then set POSTGRES_PASSWORD
docker compose up -d   # Postgres with pgvector
pnpm build && pnpm lint && pnpm typecheck && pnpm test
pnpm ingest            # downloads the demo laws into .cache/ and prints a per-law summary
pnpm index             # embeds all units and stores them in Postgres (first run: model download, ~8 min)
pnpm eval              # same as pnpm eval:retrieval: recall@5 and MRR over eval/questions.jsonl; writes eval/results/
```

The API (`apps/api`) exposes `GET /health`, `POST /search` with `{"question": "...", "limit": 5}` (ranked
chunks with source, path, URL and Stand) and `POST /ask` with `{"question": "..."}`, which returns
`{answer, citations[{source, path, url, quote}], refused, stand}`. `/ask` needs a configured answer model (see
"Answer providers"); without it the endpoint answers 503 and sends nothing to the network.

`pnpm ingest` fetches five laws from gesetze-im-internet.de one request at a time
(about 10 seconds), caches them, and reports units, skipped norms and the "Stand" of each
law. Pass `-- --refresh` to download again. See
[ADR 0001](docs/adr/0001-corpus-and-licensing.md) for the legal status of the data.

## Corpus model

A law is split by structure: § → Absatz → Nummer. The retrievable unit is the Absatz; a §
without Absätze is one unit. Sentences (Satz) are not split, so citations are precise to
Absatz or Nummer, for example "§ 14 Abs. 1 UStG". A Nummer label such as "§ 14 Abs. 2 Nr. 1"
locates the list item inside the Absatz and omits any "Satz" qualifier of the official form.
The corpus is read through the `CorpusSource` interface in `packages/corpus`.

## Process

Changes follow spec-driven development with [OpenSpec](https://github.com/Fission-AI/OpenSpec):
specs live in `openspec/`, decisions in `docs/adr/`. Validate with `pnpm spec`.

## Search

Chunks are the corpus units (Absatz, Nummer, or a whole norm). A unit longer than 1500 characters is
split into parts at line or word boundaries; the parts keep the unit path. Each chunk is embedded
with its citation label and title as a prefix ("§ 14 Abs. 1 UStG Ausstellung von Rechnungen ..."),
while the stored text stays the original wording. Search takes the top 50 from vector similarity and
from Postgres full-text search (`german` configuration, query words OR-ed) and merges them with
Reciprocal Rank Fusion (k = 60). Query words that are German compounds are also split into parts known
from the corpus vocabulary (for example "Umsatzsteuervoranmeldung" also searches "Umsatzsteuer" and
"Voranmeldung"). At about 4,600 chunks the vector search is an exact scan without an ANN index.

Embeddings come from `multilingual-e5-small`, run locally with transformers.js, so no text leaves the
machine after the one-time model download. The choice of the final embedding model and whether to add
a reranker are open and will be decided by an ADR based on the eval.

## Retrieval results

`eval/questions.jsonl` holds 75 German questions that the corpus answers and 14 that it does not. Each
answerable question lists the expected units and the place in the corpus it was derived from. A script
checks that every expected unit exists and that the words of each unanswerable question's topic
(`absent_terms`) occur nowhere in the corpus; it flagged seven wrong guesses while the set was written.
Seven questions are flagged `needs_review` and have not been reviewed by a second person.

A returned unit counts as a hit if it is the expected unit or its parent Absatz or §. Recall@5 is the
fraction of expected units hit in the top 5, MRR uses the first hit within the top 10. The 14
unanswerable questions are not used for these two metrics; refusal is evaluated with answer generation.

| Date       | Commit    | Embedding model       | Search                                         | recall@5 | MRR   | Index time | Weights |
| ---------- | --------- | --------------------- | ---------------------------------------------- | -------- | ----- | ---------- | ------- |
| 2026-11-03 | `90c020e` | multilingual-e5-small | hybrid (default)                               | 0.880    | 0.742 | 229 s      | 118 MB  |
| 2026-11-02 | `559c39c` | multilingual-e5-base  | hybrid                                         | 0.907    | 0.736 | 364 s      | 279 MB  |
| 2026-11-02 | `559c39c` | multilingual-e5-large | hybrid                                         | 0.907    | 0.768 | 5246 s     | 562 MB  |
| 2026-11-03 | `559c39c` | bge-m3                | hybrid                                         | 0.880    | 0.744 | 16719 s    | 570 MB  |
| 2026-11-03 | `90c020e` | multilingual-e5-small | vector only                                    | 0.960    | 0.879 | 229 s      | 118 MB  |
| 2026-11-03 | `90c020e` | multilingual-e5-small | full-text only                                 | 0.613    | 0.384 | 229 s      | 118 MB  |
| 2026-11-03 | `90c020e` | multilingual-e5-small | hybrid + reranker (bge-reranker-v2-m3, top 20) | 0.987    | 0.950 | see note   | 118 MB  |

All rows: 75 questions, local 8-bit models. Compound splitting switched off gave identical numbers (only one
question is affected). Paired bootstrap intervals for every difference are in
[ADR 0002](docs/adr/0002-embeddings-and-reranker.md); the four embedding models are not significantly
different from each other, so the smallest one is the default. Vector-only beats hybrid significantly
(MRR +0.137). The reranker improves both metrics significantly but took about 53 seconds per question on
an Apple M1, so it is off by default. Index times are single runs on a laptop that was not idle (the small
model took 1141 s in one run and 229 s in another): read them as orders of magnitude. The result file of the
reranker row stores 1141 s from that earlier run; the table value is the later one. Models not evaluated:
cloud embedding models (no key). Run a comparison with `pnpm index --embedder <name>` and
`pnpm eval:retrieval --embedder <name> [--mode vector|fts] [--rerank] [--no-compound]`, where the names are
`local-e5`, `local-e5-base`, `local-e5-large`, `local-bge-m3` and `fake`.

The commit is the head of the pull request branch the numbers were measured on (a squash merge gives it a
new hash). The full run is manual (`pnpm eval:retrieval`) and the raw result is in `eval/results/`.

Weak spots, as measured: 9 of 75 questions have no expected unit in the top 5 and 4 of them none in the
top 10. Among the misses are general questions about the scope of a whole law, for example "Für welche Steuern gilt die Abgabenordnung?" (§ 1 Abs. 1 AO) and "Für welche Diensteanbieter gilt das Digitale-Dienste-Gesetz?" (§ 1 Abs. 1 DDG); the reason has not been analyzed. The set is
small and was not tuned against, so differences of a few points between configurations are not
meaningful.

CI runs a smaller eval on fixtures with a deterministic fake embedder (14 questions, thresholds
recall@5 >= 0.7 and MRR >= 0.5; measured 0.857 and 0.665) against a Postgres service. It guards
against regressions in the search code and says nothing about quality with a real model.

## Bring your own corpus

Everything except the demo parser works on the `CorpusSource` interface (`packages/corpus`): `name`,
`loadDocuments()` (read the raw material) and `split()` (turn one document into units with a stable id, a
structural path, a citation label, a title and a URL). Index the units with `indexUnits`, search with
`HybridSearch`, and score with the functions in `packages/eval` against your own questions.

`examples/own-corpus` is a complete, small example: a folder of `.txt` files where a line starting with `# `
begins a section and each section is one citable unit. It is tested in CI (the adapter, and indexing plus a
search query against Postgres). Run it, with Postgres from `docker compose up -d`:

```sh
pnpm example "Wie viele Urlaubstage habe ich?"   # fake embedder, no model download
EMBEDDER=local-e5 pnpm example "..."              # real embeddings
```

It writes to its own Postgres schema, so it never mixes into the law index. The example documents are
invented text, not a real policy. The Markdown source under `packages/corpus/test` stays a test fixture.

## Honest limits

- **Claude has not been measured.** No real Claude run exists, so there is no number for answer quality with
  Claude. Results for other models are in "Answer evaluation" and say nothing about Claude.
- **Hybrid search currently scores below vector-only search** on this eval (MRR 0.742 versus 0.879; see
  "Retrieval results" and ADR 0002). The full-text side needs work; it is the default anyway because the
  brief asks for it, and it has not been re-tuned.
- **The reranker is not part of the service.** It improves the eval a lot, but takes about 53 seconds per
  question on the development laptop, so it is off by default and not wired into `/ask`.
- **The question set is small and written by the author.** 75 answerable and 14 unanswerable questions;
  seven are flagged `needs_review` and not reviewed by anyone else. Differences of a few points between
  configurations are not meaningful, and four embedding models could not be told apart.
- **Compound-word handling is untested by the eval.** Only one of 75 questions contains a compound that the
  splitting touches.
- **One corpus, one language, one snapshot.** Five German federal laws, taken on 2026-11-02 with the "Stand"
  shown per law. The service makes no promise that the law shown is current or complete, and nothing is
  synchronized automatically.
- **Citations are precise to Absatz or Nummer, not to Satz.** Sentences are not split.
- **Not legal advice.** See the section above.
- **Cloud embedding models were not evaluated** (no API key was provided), and no cost or latency figures
  exist for hosted generation beyond the labeled runs.
- **Out of scope for v1:** a user interface, authentication, multi-tenancy, scheduled updates, deployment
  configuration, and EU law (DSGVO, EUR-Lex).

## Answers and citations

`POST /ask` retrieves the 8 best chunks, gives them to Claude (through the Anthropic SDK) as numbered
sources, and asks for a JSON object with an answer and citations that refer to sources by number. The
code, not the model, then checks the result:

- a citation must point to one of the retrieved chunks, and its `quote` must be a non-empty, verbatim
  substring of that chunk's text (exact match, including whitespace and case);
- `source`, `path` and `url` are taken from the stored chunk, never from the model;
- an answer needs at least one verified citation;
- if any single citation fails, the whole response is a refusal, with no partial answer.

A refusal is `refused: true`, an empty `answer`, no citations and `stand: null`. It is returned when
nothing was retrieved (the model is not called), when the model declines, when its output cannot be
parsed, when verification fails, and when the model call fails. For an answer, `stand` lists the Stand of
each cited law. The model id comes only from configuration. Corpus text and the question are passed as
data and the prompt tells the model to ignore instructions inside them; the checks above do not depend on it.

The strict refusal rule trades recall for trust: an answer whose quotes are copied sloppily is refused even
if its content is right. How often that happens depends on the model and has to be measured.

## Answer providers

`ANSWER_PROVIDER` selects the model behind `/ask` and the answer eval:

- `claude` (default): the Anthropic API. Set `ANTHROPIC_API_KEY` and `ANSWER_MODEL`.
- `ollama`: a model running locally in [Ollama](https://ollama.com). Set `OLLAMA_MODEL` (a model you have
  pulled) and optionally `OLLAMA_URL` (default `http://localhost:11434`). Question and source text are sent
  only to that URL, so nothing leaves the machine.
- `openai-compatible`: any endpoint with an OpenAI-style chat completions API (for example the Google Gemini
  compatibility endpoint). Set `ANSWER_BASE_URL`, `ANSWER_API_KEY` and `ANSWER_MODEL`, and optionally
  `ANSWER_MIN_INTERVAL_MS` to space requests inside a free tier's rate limit. Question and source text
  (public law and the eval questions) **are sent to that host**, a third party, so do not use it with data that
  must stay private. Transient failures (429, 5xx, dropped connections) are retried with exponential backoff and jitter; a 429 also widens the spacing between requests.

There is no default model in the code for any provider. Keys go only in the git-ignored `.env`.

Citation verification and the refusal rule are identical for every provider. Results always name the
provider and model; a local model's numbers say nothing about Claude and the other way round.

```sh
ollama pull llama3.1:8b                    # example; about 5 GB
# .env: ANSWER_PROVIDER=ollama and OLLAMA_MODEL=llama3.1:8b
pnpm eval:answers                          # 89 requests, runs locally
```

To use a free hosted model instead, create a key (for Gemini: Google AI Studio, "Get API key"), then in `.env`
set `ANSWER_PROVIDER=openai-compatible`, `ANSWER_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/`,
`ANSWER_API_KEY`, `ANSWER_MODEL` (the available names change; `GET <base url>/models` lists them) and
`ANSWER_MIN_INTERVAL_MS=6000`, and run `pnpm eval:answers`.

## Answer evaluation

`pnpm eval:answers` runs all 89 questions through the full pipeline with the real model and reports
citation validity (the share of proposed citations that pass verification), how often an answer cites an
expected norm, and refusal precision and recall (with "refused" as the positive class). It sends 89
requests to the configured model. With `claude` that costs money, so it is a manual command; with `ollama`
it is free but takes a while.

### Results: other models (not Claude)

| Date       | Commit               | Answer model                                                                          | Embedder              | Citation validity | Cites expected norm             | Refusal precision | Refusal recall |
| ---------- | -------------------- | ------------------------------------------------------------------------------------- | --------------------- | ----------------- | ------------------------------- | ----------------- | -------------- |
| 2026-11-02 | `abef35d` (see note) | ollama `llama3.1:8b`                                                                  | multilingual-e5-small | 0.486 (69/142)    | 0.867 (of 30 answered)          | 0.237             | 1.000          |
| 2026-11-02 | `7971384`            | openai-compatible `gemini-3.5-flash-lite` @ generativelanguage.googleapis.com, 4 runs | multilingual-e5-small | 0.940–0.976       | 0.956–0.971 (of 66–69 answered) | 0.609–0.700       | 1.000          |
| 2026-11-02 | `7971384`            | openai-compatible `gemini-3.1-flash-lite` @ generativelanguage.googleapis.com, 1 run  | multilingual-e5-small | 0.851 (80/94)     | 0.966 (of 59 answered)          | 0.467             | 1.000          |

None of these rows is Claude. The first is a small local model run on a laptop. Reading its numbers plainly: the
pipeline never accepted a bad citation, but the model is a poor fit for the task. Of the 75 answerable questions
only 30 were answered; 45 were refused, and all 14 unanswerable questions were refused (hence recall 1.0 and a low
precision of 0.237). Refusal reasons across all 89 questions: `citation-rejected` 44, `model-refused` 7,
`no-citations` 6, `model-error` 2. Most refusals come from the strict rule that any citation failing
verification (usually a quote that is not verbatim) rejects the whole answer.

The Gemini rows are Google models through the free tier (hosted third parties; question and source text were sent
to Google). `gemini-3.5-flash-lite` was run four times to see the spread: citation validity 0.955, 0.940, 0.954,
0.976; 66 to 69 of 75 answerable questions answered; refusal precision 0.609 to 0.700; all 14 unanswerable
questions refused every time. The main weakness is over-refusal: about 6 to 9 answerable questions are refused per
run, partly because a quote was not verbatim and partly because the model declined. No request failed. The raw
per-run files are in `eval/results/` (`...-run2.json` and so on; the unsuffixed file is run 1).
`gemini-3.1-flash-lite` was clearly worse in its one run (more non-verbatim quotes, fewer answers). Hosted models
can change or be retired without notice and runs are not guaranteed repeatable, so these are data points for this
corpus and not a ranking. The commit `7971384` is the implementation branch before squashing, so it does not exist
on `main` under that hash.

Not measured, on purpose or for lack of access: `gemini-3.8-flash` and `gemini-3-flash-preview` (so overloaded or
slow on the free tier that no run finished in a reasonable time), `gemma-4-26b-a4b-it` (stopped, too slow on the
free tier), `gemma-4-31b-it` (the endpoint returned an internal error), and every model of Mistral and Groq (no
key; Groq's free tier also appears too small for a full run in a day). **Claude has not been measured** (see below).

Note on the commit: the recorded `abef35d` is a docs-only commit made before the provider code was merged
to `main` (as `595c501`). The run was made from a local build of that provider code, but the recorded
revision does not identify it exactly, so treat the row as indicative and not exactly reproducible until
the run is repeated on `main`.

**Claude has not been measured:** no real Claude run has been executed, so there are no numbers for it here
and none are claimed. CI runs the same pipeline on fixtures with a scripted stand-in model that never
touches the network. It checks that the code and the metrics behave correctly (a faithful model scores
1.0, a model that misquotes or answers unanswerable questions is detected). It says nothing about how
Claude performs.
