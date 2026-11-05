## Context

All measurements already exist as JSON files under `eval/results`. The README repeats their numbers by hand, which is how a figure can drift from its source. GitHub renders Mermaid and SVG images in a README, and an SVG referenced from the repository needs no external host.

## Decisions

- **Mermaid for the architecture.** It is text in the repository, rendered by GitHub, and changes with the code in one diff. A drawn image would not be reviewable.
- **Generated SVG for charts.** A script reads the result files and writes the SVG, so the numbers come from the recorded runs. Hand-drawn charts are not used. No charting dependency is added: the charts are simple bars and intervals written directly as SVG.
- **Themes.** The SVG uses neutral colors and a `prefers-color-scheme` style block so it reads in both GitHub themes; every chart has a title and a description.
- **Drift check.** CI regenerates the charts and compares them with the committed files.
- **Same caveats.** Charts show confidence intervals where they exist and carry the same labels as the tables (author-written questions, small sample, lexical set favors lexical matching by construction). A chart never merges the two question sets.
- **Collapsing, not deleting.** Tables move under collapsed sections; no figure is dropped.

## Risks

- A chart can look more decisive than the data. Mitigation: intervals shown, caveats adjacent, the headline numbers link to the full tables.
- SVG rendering differs between viewers. Mitigation: plain shapes and text only, checked in light and dark themes.
