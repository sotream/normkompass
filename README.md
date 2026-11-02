# normkompass

RAG with verifiable citations for regulated documents (TypeScript).
Demo corpus: German federal law (gesetze-im-internet.de).

The goal: answer questions over a document set and always point to the exact
passage (for example "§ 14 Abs. 1 UStG"). If the corpus does not support an
answer, the service refuses instead of guessing.

## Status

Reference implementation **in development**. Implemented so far: the project scaffold,
and corpus ingest with a structure-aware parser for the demo laws. There is no search,
answer generation or evaluation yet. It is not a finished product.

## Not legal advice

Output of this project is not legal advice and makes no promise that the law
shown is current or complete.

## Quick start

Requirements: Node 24, pnpm, Docker.

```sh
pnpm install
cp .env.example .env   # then set POSTGRES_PASSWORD
docker compose up -d   # Postgres with pgvector
pnpm lint && pnpm typecheck && pnpm test
pnpm ingest            # downloads the demo laws into .cache/ and prints a per-law summary
```

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
