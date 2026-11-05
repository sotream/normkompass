# Worked example: one answer, two refusals

Three real calls of the full pipeline (`POST /ask`), made on 2026-11-05 on the commit that merged the
specification for this page (`609edaf`). Search was the default (hybrid with BM25 and citation matching,
`multilingual-e5-small`), the answer model was `gemini-3.5-flash-lite` through the free tier of a hosted third
party (question and source text went to Google). **This is not Claude** and a hosted model can behave differently
tomorrow, so read the three cases as an illustration of the rules and not as a measurement; the measurements are
in the README.

## 1. A question the corpus answers: cited answer

Question: "Wann gilt ein Landfahrzeug als neu?"

The model proposed one citation. The code checked that the quote is a verbatim substring of the retrieved chunk,
then filled in `source`, `path` and `url` from its own stored chunk, never from the model:

```json
{
  "refused": false,
  "answer": "Ein Landfahrzeug gilt als neu, wenn es nicht mehr als 6.000 Kilometer zurückgelegt hat oder wenn seine erste Inbetriebnahme im Zeitpunkt des Erwerbs nicht mehr als sechs Monate zurückliegt.",
  "citations": [
    {
      "source": "UStG",
      "path": "§ 1b Abs. 3",
      "url": "https://www.gesetze-im-internet.de/ustg_1980/__1b.html",
      "quote": "Landfahrzeug nicht mehr als 6.000 Kilometer zurückgelegt hat oder wenn seine erste Inbetriebnahme im Zeitpunkt des Erwerbs nicht mehr als sechs Monate zurückliegt;"
    }
  ],
  "stand": "UStG: zuletzt geändert durch Art. 5 G v. 29.6.2026 I Nr. 197"
}
```

The expected unit for this question in `eval/questions.jsonl` is `§ 1b Abs. 3` UStG, which is what was cited.

## 2. A question the corpus does not answer: refusal

Question: "Wie hoch ist der gesetzliche Mindestlohn pro Stunde?" (the minimum wage law is not in the corpus, and
this is one of the 14 unanswerable questions of the eval set.)

Search returned its best matches anyway, as search always returns something; the model declined to answer from
them. The diagnostics name the reason `model-refused` (no citation was proposed). The response:

```json
{ "refused": true, "answer": "", "citations": [], "stand": null }
```

## 3. A question the corpus does answer: still refused

Question: "Welche Umsätze unterliegen der Umsatzsteuer?" (expected unit: `§ 1 Abs. 1` UStG.)

The model proposed one citation, and the code rejected it (`citation-rejected`, 1 proposed and 0 valid). The
response is the same refusal as above, although the law does answer this question. That is the cost of the
strict rule, and it is the main weakness found in the answer evaluation: the rule rejects an answer whose quote
is not copied exactly, even if its content may be right, because the service would rather say nothing than show a
quote it cannot verify. Which part of the quote failed in this call was not inspected. An ad hoc question outside the eval set ("Wie lange muss ein Unternehmer Rechnungen aufbewahren?") was also
refused with `citation-rejected` in the same session; two calls are not a rate, which is measured in the README
("Answer evaluation").
