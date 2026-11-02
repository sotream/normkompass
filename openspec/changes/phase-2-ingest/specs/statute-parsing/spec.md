## ADDED Requirements

### Requirement: Structure-based splitting
The parser SHALL split a law into units following its structure: law, then §, then Absatz, then Nummer.

#### Scenario: Norm with Absätze
- **WHEN** a § contains paragraphs numbered "(1)", "(2)"
- **THEN** one unit is produced per Absatz, each with the § and Absatz in its path

#### Scenario: Norm with numbered items
- **WHEN** an Absatz contains a numbered list "1.", "2."
- **THEN** each item is addressable as a Nummer unit under that Absatz
- **AND** the Absatz unit text still contains the full list

#### Scenario: Norm without Absätze
- **WHEN** a § has a single unnumbered paragraph
- **THEN** one unit is produced for the whole §

### Requirement: Faithful text
Unit text SHALL reproduce the source wording without paraphrase; markup is reduced to plain text, preserving list numbering and sentence order.

#### Scenario: Inline markup
- **WHEN** a paragraph contains nested list markup
- **THEN** the unit text is plain text in which each list item appears with its number

### Requirement: Law-level Stand
The parser SHALL read the law's "Stand" statement and attach it to every unit of that law.

#### Scenario: Stand present
- **WHEN** a law file has a Stand entry
- **THEN** every unit of that law carries that statement

#### Scenario: Stand missing
- **WHEN** a law file has no Stand entry
- **THEN** units are still produced and the missing Stand is reported

### Requirement: Repealed and non-standard norms
The parser SHALL skip norms marked "(weggefallen)" and SHALL count them; norms of other shapes (Artikel, Anlage, unnumbered) SHALL become a single unit each instead of failing.

#### Scenario: Repealed norm
- **WHEN** a norm's title is "(weggefallen)"
- **THEN** no unit is produced for it and the skip count increases

#### Scenario: Unknown shape
- **WHEN** a norm has no recognizable § number
- **THEN** it becomes one unit and is listed in the parse report

### Requirement: Source URL per unit
Every unit SHALL carry a URL that points to its norm on the source site.

#### Scenario: § URL
- **WHEN** a unit for UStG § 14 is produced
- **THEN** its URL points to the § 14 page of the UStG on gesetze-im-internet.de
