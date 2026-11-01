## ADDED Requirements

### Requirement: Mandatory checks on pull requests
CI SHALL run lint, typecheck, tests, and `openspec validate --all --strict` for every pull request targeting `main`.

#### Scenario: All checks pass
- **WHEN** a pull request contains valid code and valid specs
- **THEN** every CI check completes successfully

#### Scenario: Invalid spec
- **WHEN** a pull request contains a spec or change that fails `openspec validate --strict`
- **THEN** CI fails

#### Scenario: Type error
- **WHEN** a pull request introduces a TypeScript error
- **THEN** CI fails at the typecheck step

### Requirement: No secrets or paid services in CI
CI SHALL run without repository secrets and without calls to paid third-party APIs.

#### Scenario: Pull request from a fork
- **WHEN** CI runs for a pull request from a fork
- **THEN** all checks run without access to any secret

### Requirement: Automated dependency updates
The repository SHALL configure Dependabot for npm packages, GitHub Actions, and Docker images.

#### Scenario: Outdated dependency
- **WHEN** a monitored dependency has a newer release
- **THEN** Dependabot opens an update pull request
