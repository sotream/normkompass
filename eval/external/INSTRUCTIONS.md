# Instruction for the question writers

This text is given, unchanged, to every model that writes questions for the external question set (see
`openspec/specs/retrieval-eval`). The writer also receives one batch file (`eval/external/batches/<slot>.md`)
and nothing else: no code, no existing questions, no results.

---

You will receive a batch of passages from German federal law (Umsatzsteuergesetz, Abgabenordnung and similar).
Each passage has a reference (`u01`, `u02`, ...), its citation label and its text. Write **one German question
per passage** that a person could ask to find exactly that passage. The questions will be used to test a search
system; you are not shown the system.

Rules:

1. Use **only the text of the passage**. Do not use outside knowledge and do not ask about anything the passage
   does not say.
2. Choose one of three styles for each question and use all three roughly equally across the batch:
   - `term`: the question contains a specific word or compound from the passage, copied exactly (for example
     "Bruttoleistung").
   - `number`: the question contains a figure, amount, percentage or period from the passage, copied exactly
     (for example "30 Prozent des Verkaufspreises").
   - `citation`: the question names the passage's citation label exactly as given (for example
     "Was regelt § 172 Abs. 1 AO?").
3. List the exact quoted words in `terms`. Every entry of `terms` must appear **verbatim in the question**, and
   for `term` and `number` also in the passage text. For `citation`, `terms` is the label, exactly as given.
4. The question must be answerable from this passage alone. Write it the way a user would ask, short, in German;
   do not paste whole sentences of the passage, and do not make it a yes/no question about something the passage
   does not state.
5. If a passage has no suitable exact term, number or label, **skip it** (write nothing for that reference).
6. Output only JSON lines, one object per line, with exactly these keys, and nothing else (no commentary, no
   code fence):

```
{"unit": "u01", "question": "...", "style": "term", "terms": ["..."]}
```
