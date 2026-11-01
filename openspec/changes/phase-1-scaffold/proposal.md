## Why

The project has an empty repository. Before any retrieval or generation code
is written, it needs a reproducible workspace, automated quality gates, and
written repository policies, so that every later phase is built and reviewed
on the same foundation.

## What Changes

- Add a pnpm workspace (Node 24, TypeScript strict) with a minimal set of
  packages that later phases fill in.
- Add Docker Compose with Postgres including the pgvector extension.
- Add a CI pipeline: lint, typecheck, test, and `openspec validate --strict`.
- Add Dependabot configuration for npm packages, GitHub Actions and Docker.
- Add `SECURITY.md`, an ADR template, a README skeleton, and `.env.example`.
- Adopt OpenSpec (version pinned in devDependencies) as the change process.

No retrieval, ingestion, or generation behavior is introduced. No license is
added; that decision belongs to the repository owner.

## Capabilities

### New Capabilities

- `dev-environment`: how a contributor installs, builds, and starts local services.
- `ci-pipeline`: which automated checks run on every pull request.
- `repository-policy`: security reporting, decision records, secrets hygiene, README honesty.

### Modified Capabilities

None.

## Impact

- New root files: `package.json`, `pnpm-workspace.yaml`, `tsconfig`, lint and format config, `compose.yaml`, `.env.example`, `SECURITY.md`, `docs/adr/`.
- New `.github/` workflows and Dependabot config.
- Branch protection is configured by the owner after the first green CI run; it is out of scope here.
