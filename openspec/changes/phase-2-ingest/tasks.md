## 1. Interface and package

- [ ] 1.1 Create `packages/corpus` with the `CorpusSource` interface and unit types
- [ ] 1.2 Add the markdown-folder source as a test fixture implementation and test it

## 2. Statute parser

- [ ] 2.1 Collect real XML fixtures (trimmed excerpts) for UStG, UStDV, AO, BDSG, DDG
- [ ] 2.2 Parse norms into § units; extract title, Stand, URL
- [ ] 2.3 Split into Absatz units and Nummer child units; build citation paths
- [ ] 2.4 Handle repealed norms, Artikel/Anlage norms, and unknown shapes; add tests for each

## 3. Ingest

- [ ] 3.1 Implement the gesetze-im-internet source: slug resolution, polite fetch, `.cache/` handling
- [ ] 3.2 Add `pnpm ingest` with a per-law summary (units, skipped, Stand)
- [ ] 3.3 Test fetch behavior with a stubbed HTTP layer (pause, User-Agent, cache hit)

## 4. Decision record and archive

- [ ] 4.1 Write ADR 0001 on data licensing (§ 5 UrhG) and site terms, citing sources
- [ ] 4.2 Run `openspec archive phase-2-ingest` and fill Purpose sections of new specs
