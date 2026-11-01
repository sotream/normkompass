## Context

Phase 1 sets up tooling only. Later phases add ingestion (2), search and eval (3),
generation (4), and ADR-driven model choices (5).

## Decisions

- **Workspace layout**: `apps/api` (NestJS, skeleton only) and `packages/*` created
  by later phases as needed. Phase 1 creates only what a green CI requires, to avoid
  empty placeholder packages.
- **Node version**: Node 24 declared in `engines`, `.nvmrc`, and CI.
  Local machines on newer Node are not blocked (`>=24`).
- **Lint and format**: ESLint with typescript-eslint, Prettier. Single root config.
- **Postgres image**: the official pgvector image, pinned to a major version tag.
  The `german` full-text configuration ships with Postgres, so no extra setup is
  needed in this phase.
- **Secrets**: only `.env.example` with placeholder values is committed.
- **OpenSpec**: installed as a pinned devDependency and run through `pnpm exec`,
  so CI and contributors use the same version. Initialized without agent-specific
  files (`--tools none`).
- **CI scope**: no paid API calls and no secrets required in CI.

## Risks

- Dependency versions drift quickly; Dependabot is added to surface updates.
- A single CI job is simple but slower than parallel jobs; acceptable at this size.
