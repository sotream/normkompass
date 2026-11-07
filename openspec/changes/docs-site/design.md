## Context

GitHub Pages can serve a folder built by a workflow. The README is written for GitHub's renderer (Mermaid blocks, collapsed sections, relative links to files and charts), so the site must render the same constructs or degrade to readable text.

## Decisions

- **Generated, not written.** Pages come from the README, the ADRs and the worked example. A reader of the site sees the same sentences as a reader of the repository, so the "no unsupported claims" rule has one place to be enforced.
- **Build with a script and a Markdown renderer**, no framework and no client-side JavaScript beyond what Mermaid needs to draw the architecture diagram. Mermaid is loaded from a pinned CDN version, and the source of the diagram stays visible as text if it cannot load.
- **Deploy by workflow.** The site is built in CI on every pull request (checks only) and deployed only from `main`, with the minimal permissions Pages deployment needs. Nothing is committed to a `gh-pages` branch.
- **Link and image check.** The build fails on a broken internal link or image so the site cannot silently lose the charts or ADRs.
- **Footer.** Each page states the commit it was built from, the Stand caveat and that it is not legal advice.
- **No tracking.** No analytics, no cookies, no third-party fonts; the only external request is the pinned diagram library.
- **Website field.** Set to the site address after the first deployment succeeds and the address answers with the site, not before.

## Risks

- The README may use constructs the renderer handles differently from GitHub; the build check and a manual look at the deployed pages cover this, and unsupported constructs are fixed in the README or rendered as plain text.
- A CDN script is a third-party dependency; it is pinned and optional, and the page is complete without it.
- A workflow that deploys needs repository settings; a first deployment can fail until Pages is set to deploy from workflows, so enabling it is part of the tasks.
