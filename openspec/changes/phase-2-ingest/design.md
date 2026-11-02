## Context

Source format (checked against the live UStG file): one XML document per law, one
`<norm>` per structural element. Metadata carries `<enbez>` ("§ 14"), `<titel>`,
and law-level `<standangabe>` entries with type "Stand". Body text is `<P>` elements
whose paragraph number is written inline as "(1)". Numbered lists are nested
`<DL><DT>1.</DT><DD>…` elements. Repealed norms have title "(weggefallen)".
`robots.txt` of the site allows all access.

## Decisions

- **Chunk granularity**: the retrievable unit is the Absatz. Numbered items (Nummer)
  stay inside their parent Absatz text and are addressable as child units by path
  (for example "§ 14 Abs. 1 Nr. 2"). A § without Absätze is one unit.
- **Satz is not split in v1.** German sentence splitting is unreliable around
  abbreviations and references, and a wrong "Satz 3" citation is worse than none.
  Citation precision stops at Absatz/Nummer. Open for review.
- **Repealed norms** ("weggefallen") are skipped and counted in the ingest report.
- **Stand**: taken from the law-level `standangabe` of type "Stand" and stored on every unit.
- **Download**: one request at a time, fixed pause between requests, User-Agent naming
  the repository, raw files cached under `.cache/`. A forced refresh is explicit.
- **Interface scope**: `CorpusSource` has loading and splitting only. No further abstractions.
- **Fixtures**: only short excerpts from the real XML, trimmed to a few norms per law.

## Risks

- The XML structure varies between laws (Anlagen, Artikel-based laws, tables). The parser
  must degrade to a single unit per norm rather than fail; unknown shapes are reported.
- The site may change its format or URLs; the ingest report makes breakage visible.
