# normkompass

RAG with verifiable citations for regulated documents (TypeScript).
Demo corpus: German federal law (gesetze-im-internet.de).

The goal: answer questions over a document set and always point to the exact
passage (for example "§ 14 Abs. 1 UStG"). If the corpus does not support an
answer, the service refuses instead of guessing.

## Status

Reference implementation **in development**. Only the project scaffold exists so
far; there is no retrieval, ingestion or generation yet. It is not a finished product.

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
```

## Process

Changes follow spec-driven development with [OpenSpec](https://github.com/Fission-AI/OpenSpec):
specs live in `openspec/`, decisions in `docs/adr/`. Validate with `pnpm spec`.
