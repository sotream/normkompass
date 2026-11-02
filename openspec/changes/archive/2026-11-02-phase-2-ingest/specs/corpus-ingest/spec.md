## ADDED Requirements

### Requirement: Demo corpus ingest command
`pnpm ingest` SHALL fetch UStG, UStDV, AO, BDSG, and DDG from gesetze-im-internet.de, parse them, and print a per-law summary with unit count, skipped norms, and Stand.

#### Scenario: First run
- **WHEN** a user runs `pnpm ingest` with an empty cache
- **THEN** the five laws are downloaded and parsed
- **AND** the summary lists each law with its Stand

### Requirement: Polite access to the source site
The ingest SHALL issue requests one at a time with a pause between them and a User-Agent that identifies the project and its repository URL.

#### Scenario: Several laws
- **WHEN** multiple laws are downloaded
- **THEN** no two requests are in flight at once
- **AND** each request carries the project User-Agent

### Requirement: Local raw cache
Downloaded raw files SHALL be stored in `.cache/`, which git ignores, and a later run SHALL reuse them without network access unless a refresh is requested.

#### Scenario: Second run
- **WHEN** a user runs `pnpm ingest` again with a populated cache
- **THEN** no network request is made

#### Scenario: Forced refresh
- **WHEN** a user runs `pnpm ingest` with the refresh option
- **THEN** the files are downloaded again

### Requirement: No raw law text in the repository
The repository SHALL NOT contain complete raw law files; only short excerpts needed as test fixtures MAY be committed.

#### Scenario: Repository content
- **WHEN** the repository tree is inspected
- **THEN** no complete law XML file is present outside `.cache/`

### Requirement: Source terms documented
The legal status of the data and the site's terms of use SHALL be recorded in an ADR that cites its sources.

#### Scenario: ADR present
- **WHEN** a reader opens `docs/adr/`
- **THEN** an ADR on corpus and licensing exists and cites the sources it relies on
