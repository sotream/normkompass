## Context

GitHub shows an outline for a README but only behind a small button, and many readers never open it. Badges are images served by a third party; the CI badge comes from GitHub itself.

## Decisions

- **Badges state facts only.** CI status, license, Node version and language, database. Each is checkable in the repository. A badge that would imply a quality claim (coverage, "production ready", download counts) is not used.
- **Static badges are fine, with alt text.** The badge images come from a badge service and are not part of the page's meaning: every badge has alt text, and the same facts remain in the text below.
- **Table of contents is written by hand and tested.** A test reads the README, collects the second-level headings, and fails when a heading is missing from the list or a link points to no heading. This keeps the list honest without a build step.
- **Grouped, not flat.** About a dozen entries in five groups are easier to scan than one long list.
- **Related project link waits for the project.** Linking a repository that does not exist, or implying features it does not have, would break the rule that the README states only what is true.
- **Title casing.** The display title is capitalized; the repository, the package names and commands keep their lowercase names.

## Risks

- A badge service can be down or change; the text carries the same facts.
- The test only checks the table of contents against headings, not the quality of the section text.
