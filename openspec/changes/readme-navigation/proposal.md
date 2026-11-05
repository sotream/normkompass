## Why

The README opens with a lowercase repository name and two plain lines, and it has grown to about 400 lines with no way to jump to a part. A reader who wants one thing (the quick start, the limits, the results) has to scroll. The project is also about to get a companion repository, an MCP server that exposes its search to an agent, and nothing in the README connects the two.

## What Changes

- Replace the plain heading with a proper project title and a one-line description, and add a short row of badges that each state a fact a reader can verify (CI status of the default branch, license, required Node version, language, the database). No badge for a number the repository does not measure, such as coverage.
- Add a table of contents near the top, grouped (overview, use it, results, limits, reference), linking to every second-level section, so a reader can jump instead of scrolling.
- Add a short "Related projects" section that links to the MCP server repository and says plainly what it is and its status. The link is added only when that repository exists and describes itself as in development or finished; until then the README does not mention it.
- Keep every existing section, figure and caveat; nothing is removed or reworded except the heading and the new navigation parts.

Out of scope: splitting the README into several documents, changing any measured number, translating the README, a documentation website.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `project-docs`: the README has a title block with verifiable badges, a table of contents, and a section linking the related project.

## Impact

- README edits only, plus a test that keeps the table of contents in step with the headings so it cannot drift.
- No change to code, results or charts.
