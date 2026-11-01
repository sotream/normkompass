# repository-policy Specification

## Purpose
Defines repository-level policies: security reporting, secrets hygiene, decision records and an honest README.

## Requirements

### Requirement: Security reporting policy
The repository SHALL contain a `SECURITY.md` that tells reporters how to disclose vulnerabilities privately and what to expect in response.

#### Scenario: Reporter looks for a channel
- **WHEN** a reporter opens `SECURITY.md`
- **THEN** it names a private reporting channel and states that public issues must not be used for vulnerabilities

### Requirement: No secrets in the repository
The repository SHALL NOT contain credentials, API keys, or `.env` files; only `.env.example` with placeholder values is committed.

#### Scenario: Local environment file
- **WHEN** a contributor creates a `.env` file
- **THEN** git ignores it

### Requirement: Architecture decision records
Significant technical decisions SHALL be recorded as ADRs in `docs/adr/` using a shared template with context, decision, alternatives, and consequences.

#### Scenario: New decision
- **WHEN** a contributor needs to record a decision
- **THEN** a template is available in `docs/adr/`

### Requirement: Honest README
The README SHALL state the project status accurately, SHALL state that it is not legal advice, and SHALL NOT make unverified claims about production readiness, scale, or customers.

#### Scenario: Status statement
- **WHEN** a reader opens the README
- **THEN** it describes the project as a reference implementation in development
- **AND** it contains a notice that the output is not legal advice
