## 1. Workspace

- [ ] 1.1 Add pnpm workspace, root TypeScript strict config, `.nvmrc` (24), `engines`
- [ ] 1.2 Add ESLint, Prettier, and Vitest with one passing smoke test
- [ ] 1.3 Add `apps/api` NestJS skeleton with a health endpoint and its test

## 2. Local services

- [ ] 2.1 Add `compose.yaml` with Postgres + pgvector, healthcheck, named volume
- [ ] 2.2 Add `.env.example` with placeholders only; keep `.env` ignored
- [ ] 2.3 Verify `docker compose up` starts a healthy database with the `vector` extension available

## 3. CI and automation

- [ ] 3.1 Add GitHub Actions workflow: install (frozen lockfile), lint, typecheck, test, `openspec validate --all --strict`
- [ ] 3.2 Add Dependabot config for npm, GitHub Actions, and Docker

## 4. Repository policy and docs

- [ ] 4.1 Add `SECURITY.md` with a private reporting channel via GitHub security advisories
- [ ] 4.2 Add ADR template and `docs/adr/README.md`
- [ ] 4.3 Replace README with a skeleton: purpose, status, not-legal-advice notice, quick start, process
- [ ] 4.4 Run `openspec archive phase-1-scaffold` so `openspec/specs/` reflects the new capabilities
