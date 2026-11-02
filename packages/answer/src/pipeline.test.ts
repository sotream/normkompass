import { describe, expect, it, vi } from 'vitest';
import { AnswerPipeline } from './pipeline.js';
import { ScriptedModel } from './scripted-model.js';
import { makeHit } from './test-hits.js';
import type { Retriever } from './types.js';

const HIT1 = makeHit({
  text: '(1) Rechnung ist jedes Dokument, mit dem über eine Lieferung abgerechnet wird.',
});
const HIT2 = makeHit({
  unitId: 'ddg/§ 5/Abs. 1',
  source: 'DDG',
  path: ['§ 5', 'Abs. 1'],
  label: '§ 5 Abs. 1 DDG',
  url: 'https://www.gesetze-im-internet.de/ddg/__5.html',
  stand: 'Zuletzt geändert durch Art. 26 Abs. 2 G v. 25.3.2026 I Nr. 81',
  text: '(1) Diensteanbieter haben folgende Informationen ständig verfügbar zu halten.',
});

const retriever = (hits = [HIT1, HIT2]): Retriever => ({ search: () => Promise.resolve(hits) });
const json = (o: unknown): string => JSON.stringify(o);
const answer = (citations: { chunk: number; quote: string }[], text = 'Antwort.'): string =>
  json({ refused: false, answer: text, citations });

describe('AnswerPipeline', () => {
  it('returns an answer whose citations come from the retrieved chunk', async () => {
    const model = new ScriptedModel(() =>
      json({
        refused: false,
        answer: 'Eine Rechnung ist ein Dokument.',
        citations: [
          {
            chunk: 1,
            quote: 'Rechnung ist jedes Dokument',
            path: '§ 99',
            url: 'https://evil.test',
          },
        ],
      }),
    );
    const { response, diagnostics } = await new AnswerPipeline(retriever(), model).ask(
      'Was ist eine Rechnung?',
    );
    expect(response).toEqual({
      answer: 'Eine Rechnung ist ein Dokument.',
      citations: [
        {
          source: 'UStG',
          path: '§ 14 Abs. 1',
          url: 'https://www.gesetze-im-internet.de/ustg_1980/__14.html',
          quote: 'Rechnung ist jedes Dokument',
        },
      ],
      refused: false,
      stand: 'UStG: zuletzt geändert durch Art. 5 G v. 29.6.2026 I Nr. 197',
    });
    expect(diagnostics).toMatchObject({
      proposedCitations: 1,
      validCitations: 1,
      citedUnitIds: [HIT1.unitId],
    });
  });

  it('puts the Stand of every cited law into stand', async () => {
    const model = new ScriptedModel(() =>
      answer([
        { chunk: 1, quote: 'Rechnung ist jedes Dokument' },
        { chunk: 2, quote: 'Informationen ständig verfügbar' },
      ]),
    );
    const { response } = await new AnswerPipeline(retriever(), model).ask('Frage?');
    expect(response.stand).toBe(
      'UStG: zuletzt geändert durch Art. 5 G v. 29.6.2026 I Nr. 197; ' +
        'DDG: Zuletzt geändert durch Art. 26 Abs. 2 G v. 25.3.2026 I Nr. 81',
    );
  });

  it('refuses without calling the model when nothing was retrieved', async () => {
    const model = new ScriptedModel(() => answer([]));
    const { response, diagnostics } = await new AnswerPipeline(retriever([]), model).ask('Frage?');
    expect(response).toEqual({ answer: '', citations: [], refused: true, stand: null });
    expect(diagnostics.reason).toBe('no-retrieval');
    expect(model.calls).toBe(0);
  });

  it('refuses when the model refuses', async () => {
    const model = new ScriptedModel(() => json({ refused: true, answer: '', citations: [] }));
    const { response, diagnostics } = await new AnswerPipeline(retriever(), model).ask('Frage?');
    expect(response).toEqual({ answer: '', citations: [], refused: true, stand: null });
    expect(diagnostics.reason).toBe('model-refused');
  });

  it('refuses, with no answer text, when the model invents a quote', async () => {
    const model = new ScriptedModel(() =>
      answer(
        [{ chunk: 1, quote: 'Eine Rechnung muss immer auf Papier erfolgen' }],
        'Erfundene Antwort.',
      ),
    );
    const { response, diagnostics } = await new AnswerPipeline(retriever(), model).ask('Frage?');
    expect(response).toEqual({ answer: '', citations: [], refused: true, stand: null });
    expect(diagnostics).toMatchObject({
      reason: 'citation-rejected',
      proposedCitations: 1,
      validCitations: 0,
    });
  });

  it('refuses entirely when one of several citations is invalid', async () => {
    const model = new ScriptedModel(() =>
      answer([
        { chunk: 1, quote: 'Rechnung ist jedes Dokument' },
        { chunk: 2, quote: 'Informationen ständig verfügbar' },
        { chunk: 2, quote: 'nicht im Gesetz enthalten' },
      ]),
    );
    const { response, diagnostics } = await new AnswerPipeline(retriever(), model).ask('Frage?');
    expect(response.refused).toBe(true);
    expect(response.answer).toBe('');
    expect(response.citations).toEqual([]);
    expect(diagnostics).toMatchObject({ proposedCitations: 3, validCitations: 2 });
  });

  it('refuses an answer without citations', async () => {
    const model = new ScriptedModel(() => answer([]));
    const { response, diagnostics } = await new AnswerPipeline(retriever(), model).ask('Frage?');
    expect(response.refused).toBe(true);
    expect(diagnostics.reason).toBe('no-citations');
  });

  it('refuses an empty answer even if the citations are valid', async () => {
    const model = new ScriptedModel(() => answer([{ chunk: 1, quote: 'Rechnung ist' }], '  '));
    const { diagnostics } = await new AnswerPipeline(retriever(), model).ask('Frage?');
    expect(diagnostics.reason).toBe('empty-answer');
  });

  it('refuses unparsable output', async () => {
    const model = new ScriptedModel(() => 'Das weiß ich nicht.');
    const { response, diagnostics } = await new AnswerPipeline(retriever(), model).ask('Frage?');
    expect(response.refused).toBe(true);
    expect(diagnostics.reason).toBe('unparsable-output');
  });

  it('refuses and reports, but does not expose, a failing model call', async () => {
    const onModelError = vi.fn();
    const model = new ScriptedModel(() => {
      throw new Error('secret upstream detail');
    });
    const { response, diagnostics } = await new AnswerPipeline(retriever(), model, {
      onModelError,
    }).ask('Frage?');
    expect(response).toEqual({ answer: '', citations: [], refused: true, stand: null });
    expect(JSON.stringify(response)).not.toContain('secret');
    expect(diagnostics.reason).toBe('model-error');
    expect(onModelError).toHaveBeenCalledOnce();
  });

  it('gives the model the retrieved chunks as numbered sources', async () => {
    let seen: number[] = [];
    const model = new ScriptedModel(({ sources }) => {
      seen = sources.map((s) => s.number);
      return answer([{ chunk: 1, quote: 'Rechnung ist' }]);
    });
    await new AnswerPipeline(retriever(), model).ask('Frage?');
    expect(seen).toEqual([1, 2]);
  });
});
