import { describe, expect, it } from 'vitest';
import {
  MAX_UNIT_CHARS,
  convertExternal,
  isCopy,
  renderBatch,
  sampleBatches,
  summarizeByWriter,
  type SampleUnit,
} from './external.js';
import type { Question } from './questions.js';

const unit = (doc: string, n: number, text: string): SampleUnit => ({
  id: `${doc}/§ ${n}`,
  documentId: doc,
  label: `§ ${n} ${doc.toUpperCase()}`,
  title: `Titel ${n}`,
  text,
});
const filler = 'Dieser Absatz enthält genug Text, damit er für die Stichprobe in Frage kommt. ';
const corpus: SampleUnit[] = ['a', 'b', 'c'].flatMap((doc) =>
  Array.from({ length: 12 }, (_, i) => unit(doc, i + 1, `${filler}${doc}${i}`)),
);

describe('sampleBatches', () => {
  it('is reproducible for the same seed and differs for another', () => {
    const opts = { seed: 1, slots: ['a', 'b'], perSlot: 6 };
    expect(sampleBatches(corpus, opts)).toEqual(sampleBatches(corpus, opts));
    expect(sampleBatches(corpus, { ...opts, seed: 2 })).not.toEqual(sampleBatches(corpus, opts));
  });

  it('gives each slot its own units, from every law, with numbered references', () => {
    const sample = sampleBatches(corpus, { seed: 1, slots: ['a', 'b', 'c'], perSlot: 6 });
    const all = Object.values(sample.slots).flat();
    expect(new Set(all.map((e) => e.unit)).size).toBe(all.length);
    for (const batch of Object.values(sample.slots)) {
      expect(batch).toHaveLength(6);
      expect(batch.map((e) => e.ref)[0]).toBe('u01');
      expect(new Set(batch.map((e) => e.unit.split('/')[0])).size).toBe(3);
    }
  });

  it('skips units that are too short or too long and fails when too few remain', () => {
    const odd = [unit('a', 1, 'kurz'), unit('a', 2, 'x'.repeat(MAX_UNIT_CHARS + 1))];
    expect(() => sampleBatches(odd, { seed: 1, slots: ['a'], perSlot: 1 })).toThrow(/eligible/);
  });
});

describe('renderBatch', () => {
  it('shows the reference, label and text, and nothing about the system', () => {
    const sample = sampleBatches(corpus, { seed: 1, slots: ['a'], perSlot: 2 });
    const text = renderBatch('a', sample.slots.a ?? [], corpus);
    expect(text).toContain('## u01');
    expect(text).toContain('Citation label: §');
    expect(text.toLowerCase()).not.toMatch(/search|retriev|bm25|embedding/);
  });
});

describe('isCopy', () => {
  it('detects equal and near-equal questions', () => {
    expect(isCopy('Was regelt § 14 Abs. 1 UStG?', ['was regelt § 14 abs. 1 ustg'])).toBe(true);
    expect(
      isCopy('Welche Frist gilt für die Anfechtung?', ['Wann ist ein Landfahrzeug neu?']),
    ).toBe(false);
  });
});

describe('convertExternal', () => {
  const units: SampleUnit[] = [
    unit(
      'ustg',
      1,
      'Ein Landfahrzeug gilt als neu, wenn es nicht mehr als 6.000 Kilometer zurückgelegt hat.',
    ),
    unit(
      'ustg',
      2,
      'Die Bruttoleistung der Anlage ist maßgeblich für die Steuerbefreiung nach diesem Gesetz.',
    ),
    unit(
      'ustg',
      3,
      'Die Bruttoleistung wird auch in einem weiteren Absatz erwähnt, der etwas anderes regelt.',
    ),
  ];
  const sample = {
    seed: 1,
    slots: {
      a: [
        { ref: 'u01', unit: 'ustg/§ 1' },
        { ref: 'u02', unit: 'ustg/§ 2' },
      ],
    },
  };
  const line = (o: object): string => JSON.stringify(o);

  it('keeps valid questions with writer and origin and rejects the rest with a reason', () => {
    const lines = [
      line({
        unit: 'u01',
        question: 'Wann gilt ein Fahrzeug bei 6.000 Kilometer als neu?',
        style: 'number',
        terms: ['6.000 Kilometer'],
      }),
      line({ unit: 'u09', question: 'Frage?', style: 'term', terms: ['x'] }),
      line({ unit: 'u01', question: 'Frage ohne Stil?', style: 'other', terms: ['x'] }),
      line({
        unit: 'u01',
        question: 'Was ist mit 7.000 Kilometer?',
        style: 'number',
        terms: ['7.000 Kilometer'],
      }),
      'not json',
    ];
    const { questions, rejected } = convertExternal(
      [{ slot: 'a', writer: 'model-x', lines }],
      sample,
      units,
      [],
    );
    expect(questions).toHaveLength(1);
    expect(questions[0]).toMatchObject({
      id: 'e001',
      origin: 'external',
      writer: 'model-x',
      expected: ['ustg/§ 1'],
      needs_review: false,
    });
    expect(rejected.map((r) => r.reason)).toEqual([
      'unit "u09" is not in batch a',
      expect.stringContaining('style must be one of'),
      expect.stringContaining('does not occur in an expected unit'),
      'invalid JSON',
    ]);
  });

  it('flags an ambiguous question instead of dropping it, and rejects copies', () => {
    const lines = [
      line({
        unit: 'u02',
        question: 'Welche Rolle spielt die Bruttoleistung?',
        style: 'term',
        terms: ['Bruttoleistung'],
      }),
      line({
        unit: 'u02',
        question: 'Wie wird die Bruttoleistung berücksichtigt?',
        style: 'term',
        terms: ['Bruttoleistung'],
      }),
    ];
    const { questions, rejected } = convertExternal(
      [{ slot: 'a', writer: 'w', lines }],
      sample,
      units,
      ['welche rolle spielt die bruttoleistung'],
    );
    expect(rejected.map((r) => r.reason)).toEqual(['copy of an existing question']);
    expect(questions).toHaveLength(1);
    expect(questions[0]?.needs_review).toBe(true);
    expect(questions[0]?.review_note).toContain('ambiguous');
  });
});

describe('summarizeByWriter', () => {
  it('reports each writer and an overall row, not an average of averages', () => {
    const q = (id: string, writer: string): Question => ({
      id,
      question: id,
      answerable: true,
      expected: ['x'],
      needs_review: id === 'e3',
      writer,
    });
    const { rows, overall } = summarizeByWriter(
      [q('e1', 'a'), q('e2', 'a'), q('e3', 'b')],
      [
        { id: 'e1', firstHitRank: 1, recallAt5: 1 },
        { id: 'e2', firstHitRank: null, recallAt5: 0 },
        { id: 'e3', firstHitRank: 2, recallAt5: 1 },
      ],
    );
    expect(rows.map((r) => [r.writer, r.questions, r.mrr])).toEqual([
      ['a', 2, 0.5],
      ['b', 1, 0.5],
    ]);
    expect(rows[1]?.needsReview).toBe(1);
    expect(overall.questions).toBe(3);
    expect(overall.mrr).toBeCloseTo(0.5);
    expect(overall.mrrLo).toBeLessThanOrEqual(overall.mrr);
  });
});
