# dev-environment Specification

## Purpose
Defines how a contributor installs, builds and starts local services from a clean clone.

## Requirements

### Requirement: Reproducible install and build
The repository SHALL install and build from a clean clone using only documented commands, with dependency versions fixed by a lockfile.

#### Scenario: Clean clone install
- **WHEN** a contributor clones the repository and runs `pnpm install --frozen-lockfile` on Node 24
- **THEN** the install succeeds without modifying the lockfile

#### Scenario: Unsupported Node version
- **WHEN** a contributor installs on a Node major version below 24
- **THEN** the package manager reports an engine mismatch

### Requirement: Local database service
The repository SHALL provide a Docker Compose definition that starts a Postgres instance with the pgvector extension available.

#### Scenario: Start database
- **WHEN** a contributor runs `docker compose up -d` with an environment derived from `.env.example`
- **THEN** the database container becomes healthy
- **AND** `CREATE EXTENSION vector` succeeds in it

### Requirement: API health check
The API application SHALL expose a health endpoint that reports whether the process is running.

#### Scenario: Health request
- **WHEN** a client requests the health endpoint of a running API
- **THEN** the response status is 200 and the body states that the service is up
