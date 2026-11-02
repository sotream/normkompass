# corpus-source Specification

## Purpose
Defines the adapter contract between a document corpus and the rest of the system: documents in, citable structural units with metadata out.

## Requirements

### Requirement: Corpus adapter interface
The system SHALL access any document corpus through a single `CorpusSource` interface that loads documents and splits them into structural units.

#### Scenario: Two implementations
- **WHEN** a law source and a markdown-folder source are both used through the interface
- **THEN** each yields units in the same shape without the caller knowing the source type

### Requirement: Unit metadata
Every structural unit SHALL carry its source name, structural path, title, URL, the source's "Stand" date when one exists, and its text.

#### Scenario: Law unit
- **WHEN** the unit for § 14 Absatz 1 of the UStG is produced
- **THEN** its path identifies § 14 and Absatz 1, its title is the norm title, and its Stand is the law's Stand

#### Scenario: Markdown unit
- **WHEN** a unit is produced from a markdown file
- **THEN** its path is built from the heading hierarchy and its Stand is absent

### Requirement: Stable human-readable citation label
Each unit SHALL provide a citation label in the form used by the source domain, such as "§ 14 Abs. 1 UStG".

#### Scenario: Absatz label
- **WHEN** a unit for UStG § 14 Absatz 1 is labeled
- **THEN** the label is "§ 14 Abs. 1 UStG"

#### Scenario: Nummer label
- **WHEN** a unit for UStG § 14 Absatz 2 Nummer 1 is labeled
- **THEN** the label is "§ 14 Abs. 2 Nr. 1 UStG"
