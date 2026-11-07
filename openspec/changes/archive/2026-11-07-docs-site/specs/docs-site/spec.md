## ADDED Requirements

### Requirement: Site generated from repository content
The project SHALL generate its website from files in the repository (the README, the ADRs, the worked example and the charts), and the site SHALL NOT contain statements, figures or claims that are not in those files, except navigation and a footer.

#### Scenario: Reader compares site and repository
- **WHEN** a reader compares a site page with its source file
- **THEN** the text is the same apart from navigation and the footer

### Requirement: Caveats preserved
The site SHALL keep the caveats, limits and "not legal advice" statement of its sources, and every page SHALL state the commit it was built from.

#### Scenario: Footer
- **WHEN** a page is opened
- **THEN** its footer names the source commit and says the content is not legal advice

### Requirement: Broken links fail the build
The build SHALL fail when an internal link or an image in the generated site does not resolve.

#### Scenario: Missing chart
- **WHEN** a page references a chart file that does not exist
- **THEN** the build fails and names the page and the target

### Requirement: Works without scripts
Every page SHALL be readable without JavaScript, and a diagram that needs a script to be drawn SHALL leave its source readable as text.

#### Scenario: Script blocked
- **WHEN** a page is opened with JavaScript disabled
- **THEN** all text, tables and charts are visible and the diagram source is shown as text

### Requirement: No tracking
The site SHALL NOT use analytics, cookies or third-party fonts, and its only external requests SHALL be a version-pinned diagram library and the badge images that the README itself contains, each of which the documentation SHALL name as an external request.

#### Scenario: Network inspection
- **WHEN** a page is loaded
- **THEN** no request goes to an analytics or font service, and the external requests are the pinned diagram library and the README's badge images

### Requirement: Deployment from main only
Pull requests SHALL build the site as a check without deploying it, and only a push to the default branch SHALL deploy it, with the minimal workflow permissions deployment needs.

#### Scenario: Pull request
- **WHEN** a pull request is opened
- **THEN** the site is built and checked and nothing is published
