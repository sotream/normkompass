# normkompass

RAG with verifiable citations for regulated documents (TypeScript).
Demo corpus: German federal law (gesetze-im-internet.de).

The goal: answer questions over a document set and always point to the exact
passage (for example "§ 14 Abs. 1 UStG"). If the corpus does not support an
answer, the service refuses instead of guessing.

## Status

Reference implementation **in development**. Implemented so far: the project scaffold,
corpus ingest with a structure-aware parser for the demo laws, a hybrid search index, and a
retrieval evaluation, and answer generation with code-checked citations and refusal. The answer
quality with a real language model has **not been measured yet** (see "Answer evaluation"). It is not a
finished product.

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
pnpm eval:retrieval    # recall@5 and MRR over eval/questions.jsonl; writes eval/results/
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

| Date       | Commit    | Embedding model                     | Questions | recall@5 | MRR   |
| ---------- | --------- | ----------------------------------- | --------- | -------- | ----- |
| 2026-11-02 | `aa6514c` | multilingual-e5-small (local, int8) | 75        | 0.880    | 0.742 |

The commit is the head of the pull request branch the numbers were measured on (a squash merge gives it a
new hash). The full run is manual (`pnpm eval:retrieval`) and the raw result is in `eval/results/`.

Weak spots, as measured: 9 of 75 questions have no expected unit in the top 5 and 4 of them none in the
top 10. Among the misses are general questions about the scope of a whole law, for example "Für welche Steuern gilt die Abgabenordnung?" (§ 1 Abs. 1 AO) and "Für welche Diensteanbieter gilt das Digitale-Dienste-Gesetz?" (§ 1 Abs. 1 DDG); the reason has not been analyzed. The set is
small and was not tuned against, so differences of a few points between configurations are not
meaningful. No ablation of vector-only versus full-text-only search has been run yet.

CI runs a smaller eval on fixtures with a deterministic fake embedder (14 questions, thresholds
recall@5 >= 0.7 and MRR >= 0.5; measured 0.857 and 0.665) against a Postgres service. It guards
against regressions in the search code and says nothing about quality with a real model.

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
  only to that URL, so nothing leaves the machine. There is no default model in the code for either provider.

Citation verification and the refusal rule are identical for every provider. Results always name the
provider and model; a local model's numbers say nothing about Claude and the other way round.

```sh
ollama pull llama3.1:8b                    # example; about 5 GB
# .env: ANSWER_PROVIDER=ollama and OLLAMA_MODEL=llama3.1:8b
pnpm eval:answers                          # 89 requests, runs locally
```

## Answer evaluation

`pnpm eval:answers` runs all 89 questions through the full pipeline with the real model and reports
citation validity (the share of proposed citations that pass verification), how often an answer cites an
expected norm, and refusal precision and recall (with "refused" as the positive class). It sends 89
requests to the configured model. With `claude` that costs money, so it is a manual command; with `ollama`
it is free but takes a while.

### Result: local model (not Claude)

| Date       | Commit               | Answer model         | Embedder              | Citation validity | Cites expected norm    | Refusal precision | Refusal recall |
| ---------- | -------------------- | -------------------- | --------------------- | ----------------- | ---------------------- | ----------------- | -------------- |
| 2026-11-02 | `abef35d` (see note) | ollama `llama3.1:8b` | multilingual-e5-small | 0.486 (69/142)    | 0.867 (of 30 answered) | 0.237             | 1.000          |

This is a small local model run on a laptop, **not Claude**. Reading the numbers plainly: the pipeline never
accepted a bad citation, but the model is a poor fit for the task. Of the 75 answerable questions only 30
were answered; 45 were refused, and all 14 unanswerable questions were refused (hence recall 1.0 and a low
precision of 0.237). Refusal reasons across all 89 questions: `citation-rejected` 44, `model-refused` 7,
`no-citations` 6, `model-error` 2. Most refusals come from the strict rule that any citation failing
verification (usually a quote that is not verbatim) rejects the whole answer.

Note on the commit: the recorded `abef35d` is a docs-only commit made before the provider code was merged
to `main` (as `595c501`). The run was made from a local build of that provider code, but the recorded
revision does not identify it exactly, so treat the row as indicative and not exactly reproducible until
the run is repeated on `main`.

**Claude has not been measured:** no real Claude run has been executed, so there are no numbers for it here
and none are claimed. CI runs the same pipeline on fixtures with a scripted stand-in model that never
touches the network. It checks that the code and the metrics behave correctly (a faithful model scores
1.0, a model that misquotes or answers unanswerable questions is detected). It says nothing about how
Claude performs.
