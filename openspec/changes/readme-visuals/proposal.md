## Why

The README presents the measurements as long tables and describes the architecture only in prose. A reader has to work through numbers to see what the project found, and has no picture of how a question becomes either a cited answer or a refusal. The results are honest but hard to read, and nothing keeps a figure in the documentation tied to the recorded runs.

## What Changes

- Add an architecture diagram to the README, written as text in the repository (Mermaid, rendered by GitHub), showing ingest, chunking, the indexes, hybrid search, answer generation, citation verification and the refusal path.
- Add result charts as SVG files generated from the recorded result files by a script in the repository: retrieval quality per search variant on the paraphrase set and on the lexical set (reported separately), embedding model comparison with confidence intervals, and answer validity and precision for the measured models.
- Check in CI that the committed charts match what the generator produces from the recorded results, so a chart cannot drift from its data.
- Restructure the top of the README: one-paragraph summary, the diagram, a few headline numbers each linked to a results table, and quick start. Detailed tables stay in the README, collapsed, with no number removed and no caveat dropped.
- Add one worked example to the documentation: a question that gets a cited answer and one that is refused, taken from a real run.

Out of scope: new measurements, changes to search or answer behavior, a documentation website, any claim not already supported by a recorded run, translation of the documentation.

## Capabilities

### New Capabilities

- `results-charts`: charts generated from recorded results, readable in light and dark themes, checked against their data.

### Modified Capabilities

- `project-docs`: the README contains an architecture diagram and charts, every charted number is traceable to a recorded run, and the caveats shown with the tables stay next to the charts.

## Impact

- New generator script and tests under the eval package, new SVG files under `docs/`, one more CI check; no new runtime dependency for the services.
- README and documentation edits only otherwise; result files are read, never modified.
