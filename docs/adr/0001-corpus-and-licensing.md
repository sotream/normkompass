# 0001. Demo corpus and its legal status

- Status: Accepted
- Date: 2026-11-02

This ADR records what was checked about the demo data. It is not legal advice.

## Context

The demo corpus is German federal law from gesetze-im-internet.de (UStG, UStDV, AO, BDSG, DDG),
downloaded as one XML file per law. We need to know whether the texts may be processed and
shown, and under which conditions the site may be accessed automatically.

## Findings

Each statement below was read on the cited page on 2026-11-02.

1. **Law texts have no copyright.** § 5 Abs. 1 UrhG states that laws, ordinances, official
   decrees and announcements, and court decisions are not protected by copyright
   ("genießen keinen urheberrechtlichen Schutz").
   Source: <https://www.gesetze-im-internet.de/urhg/__5.html>
2. **The site gives no advice and no guarantees.** Its Impressum says the operators give no
   legal advice or case-specific information ("Eine Rechtsberatung oder Erteilung von Auskünften
   in Einzelfällen erfolgen nicht"), that use is at the user's own risk, and that no guarantee is
   given for completeness, accuracy, currency, or availability.
   Source: <https://www.gesetze-im-internet.de/impressum.html>
3. **Automated access is not excluded by `robots.txt`.** The file reads `User-agent: *` and
   `Disallow:` with no path.
   Source: <https://www.gesetze-im-internet.de/robots.txt>
4. **Machine-readable download is offered by the site.** Every law has an `xml.zip`, and the
   site publishes a table of contents of all downloads.
   Source: <https://www.gesetze-im-internet.de/gii-toc.xml>

## Not established

- No page found states explicit terms of use for automated or bulk access or for reuse of the
  compiled database. The Impressum does not cover it. We did not assess database rights
  (§ 87a ff. UrhG) in the site's compilation, nor whether the editorial "Stand" annotations
  are protected. A client deployment should have these points reviewed.
- Laws change. Every unit carries the "Stand" statement of its law, and answers must show it,
  but this project makes no claim that the text is current.

## Decision

- Use the five laws as demo corpus.
- Access the site politely: one request at a time, a pause of 2 seconds between requests, and
  a User-Agent that names this repository. Cache raw files locally in `.cache/`.
- Do not commit complete raw law files. Only short excerpts of a few norms per law are
  committed as test fixtures, and a test fails if a larger XML file is tracked.
- State in the README that output is not legal advice.

## Alternatives considered

- Commit the full corpus for offline reproducibility: rejected, because the legal position on
  the site's compilation is not established and the download is simple.
- A third-party mirror or dataset: rejected, because its provenance and currency would be
  harder to verify than the official source.

## Consequences

- A fresh clone needs network access once (`pnpm ingest`).
- The ingest is slow by design (about 10 seconds for five laws).
- If the site changes its format or URLs, ingest fails loudly and the parser report shows it.
