## ADDED Requirements

### Requirement: Title block with verifiable badges
The README SHALL open with a project title and a one-line description, followed by badges, and each badge SHALL state a fact that can be checked in the repository (CI status, license, required runtime, language, database) and SHALL have alt text.

#### Scenario: Reader checks a badge
- **WHEN** a reader compares a badge with the repository
- **THEN** the badge matches the workflow, the license file, the declared runtime or the stack it names

#### Scenario: Quality badge
- **WHEN** a badge would express a measured quality figure or a readiness claim
- **THEN** it is not shown

### Requirement: Table of contents
The README SHALL contain a table of contents near the top that links to every second-level section, and a test SHALL fail when a section is missing from it or a link points to no section.

#### Scenario: New section
- **WHEN** a second-level section is added to the README without a table of contents entry
- **THEN** the test fails

#### Scenario: Reader jumps
- **WHEN** a reader follows a table of contents link
- **THEN** it leads to the section of that name

### Requirement: Related projects
The README SHALL link a related repository only if it exists, and SHALL state what it is and its real status in one or two sentences, without claiming features it does not have.

#### Scenario: Companion repository in development
- **WHEN** the companion repository exists but is not finished
- **THEN** the README says it is in development
