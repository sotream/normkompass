## Why

The repository has no website, so the "Website" field of its GitHub page is empty, and a reader who does not want to read a 400-line README on GitHub has no easier way in. The content already exists (README, charts, ADRs, a worked example), so a small static site generated from those files costs little and cannot say anything the repository does not.

## What Changes

- Generate a static site from the files in the repository: the README as the landing page, one page per ADR, the worked example, and the charts, with a navigation bar and the same caveats as the sources. The site adds no text of its own beyond navigation and a short footer stating the source commit and that it is not legal advice.
- Build it with a script in the repository and check in CI that it builds and that every internal link and image resolves.
- Deploy it to GitHub Pages from `main` with a workflow; pull requests build the site but do not deploy.
- After the first successful deployment, set the repository's Website field to the site address.
- Enabling GitHub Pages is a repository setting, which the repository owner explicitly authorized for this change.

Out of scope: a custom domain, analytics or any tracking, a search backend, translations, a design beyond a plain readable layout, and any content not already in the repository.

## Capabilities

### New Capabilities

- `docs-site`: the generated site, its content rules, its build checks and its deployment.

### Modified Capabilities

- `project-docs`: the README links to the site and the claim rules apply to the site as they do to the README.

## Impact

- A build script and tests under the repository's tooling, one new CI step, one deployment workflow, one new small dependency for rendering Markdown (version pinned and chosen at implementation), README link, and the Website field of the repository.
- No change to search, answers or evaluation.
