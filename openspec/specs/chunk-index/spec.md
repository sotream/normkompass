# chunk-index Specification

## Purpose
Defines how corpus units are stored as searchable chunks in Postgres: metadata, German full-text vectors, per-model embeddings with a context prefix, and idempotent indexing.

## Requirements

### Requirement: Units stored as chunks
The system SHALL store every corpus unit as a chunk with its source, path, label, title, URL, Stand, and full original text.

#### Scenario: Index the demo corpus
- **WHEN** a user runs `pnpm index` after `pnpm ingest`
- **THEN** every unit produced by ingest is present as a chunk
- **AND** each chunk keeps the Stand of its law

### Requirement: Context prefix in embeddings
The embedding input of a chunk SHALL consist of its citation label and title followed by its text, while the stored and returned chunk text SHALL be the original unit text without that prefix.

#### Scenario: Embedding input
- **WHEN** the chunk for § 14 Abs. 1 UStG is embedded
- **THEN** the embedded text begins with "§ 14 Abs. 1 UStG" and the norm title
- **AND** the stored chunk text begins with "(1) Rechnung ist jedes Dokument"

### Requirement: Over-long units
A unit longer than the embedding input limit SHALL be split into consecutive parts at line boundaries; every part SHALL keep the unit's path and carry a part number, and the concatenated parts SHALL equal the original text.

#### Scenario: Long table
- **WHEN** a unit exceeds the limit
- **THEN** it is stored as several chunks with the same path and increasing part numbers
- **AND** joining their texts reproduces the unit text

### Requirement: Idempotent indexing
Running the index command again SHALL not create duplicate chunks, and SHALL replace the stored data of changed units.

#### Scenario: Second run
- **WHEN** `pnpm index` runs twice on the same corpus
- **THEN** the chunk count is the same after both runs

### Requirement: Replaceable embedding model
Embeddings SHALL be stored together with the name of the model that produced them, and indexing with a different model SHALL NOT overwrite embeddings of another model.

#### Scenario: Two models
- **WHEN** the corpus is indexed with two different embedding models
- **THEN** both sets of embeddings exist and search can use either
