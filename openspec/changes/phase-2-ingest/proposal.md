## Why

Retrieval, citations, and evaluation all depend on a corpus that is split into
units a citation can point to ("§ 14 Abs. 1 UStG"). Phase 2 delivers the corpus
foundation: fetch the demo laws politely, parse their structure faithfully, and
expose them through one adapter interface so a client corpus can be plugged in later.

## What Changes

- Add the `CorpusSource` interface: load documents and split them into structural units with metadata.
- Add one implementation for German federal laws from gesetze-im-internet.de (UStG, UStDV, AO, BDSG, DDG).
- Add `pnpm ingest`: polite single-threaded download into a git-ignored `.cache/`, then parse and report.
- Add a parser for the law XML structure (law, §, Absatz, Nummer) that keeps the "Stand" of each law.
- Add a markdown-folder source used only as a test fixture, proving the interface is not law-specific.
- Add ADR 0001 recording the legal status of the data and the site's terms, with cited sources.
- Test the parser on real XML fixtures.

Out of scope: database storage, embeddings, search (phase 3), generation (phase 4).
No raw laws are committed except small excerpts needed as test fixtures; the ADR records why that is acceptable.

## Capabilities

### New Capabilities

- `corpus-source`: the adapter contract between a document corpus and the rest of the system.
- `corpus-ingest`: fetching and caching the demo laws.
- `statute-parsing`: turning law XML into structural units with citation paths.

### Modified Capabilities

None.

## Impact

- New workspace package for the corpus code, new root script `ingest`.
- New test fixtures: XML excerpts of the five laws and a small markdown folder.
- New ADR `docs/adr/0001-corpus-and-licensing.md`.
