import { describe, expect, it } from 'vitest';
import { RarityIndex, stems, summarizeDiagnosis, type QuestionDiagnosis } from './diagnose.js';

const units = [
  {
    id: 'a',
    title: 'Rechnung',
    text: 'Der Unternehmer stellt eine Rechnung aus. Der Unternehmer prüft.',
  },
  {
    id: 'b',
    title: 'Gelangensbestätigung',
    text: 'Der Unternehmer erhält die Gelangensbestätigung vom Abnehmer.',
  },
  { id: 'c', title: 'Sonstiges', text: 'Der Unternehmer meldet die Umsätze.' },
];

describe('stems', () => {
  it('lower-cases, drops short words and cuts to six letters', () => {
    expect(stems('Der Unternehmer stellt die Rechnung aus')).toEqual([
      'untern',
      'stellt',
      'rechnu',
    ]);
  });
});

describe('RarityIndex', () => {
  const index = new RarityIndex(units);

  it('gives a rare stem a higher weight than a common one', () => {
    expect(index.idf('gelang')).toBeGreaterThan(index.idf('untern'));
  });

  it('prefers the unit holding the rare term over one that only repeats the common term', () => {
    const q = 'Unternehmer Gelangensbestätigung';
    const [a, b] = [units[0], units[1]];
    expect(index.overlap(q, b!)).toBeGreaterThan(index.overlap(q, a!));
  });
});

describe('summarizeDiagnosis', () => {
  const row = (over: Partial<QuestionDiagnosis>): QuestionDiagnosis => ({
    id: 'q',
    question: 'F?',
    expected: ['x'],
    vectorRank: 1,
    ftsRank: 1,
    ftsOutranking: [],
    expectedOverlap: 1,
    ftsTopOverlap: 1,
    ...over,
  });

  it('counts who solves what and compares rarity on full-text failures', () => {
    const s = summarizeDiagnosis([
      row({}),
      row({ ftsRank: null, ftsTopOverlap: 0.5 }),
      row({ ftsRank: 9, ftsTopOverlap: 2 }),
      row({ vectorRank: null, ftsRank: 2 }),
      row({ vectorRank: 12, ftsRank: null, ftsTopOverlap: 1 }),
    ]);
    expect(s).toMatchObject({
      questions: 5,
      both: 1,
      vectorOnly: 2,
      ftsOnly: 1,
      neither: 1,
      ftsFailures: 3,
      rarityPrefersExpected: 1,
      rarityPrefersWrong: 1,
      rarityTies: 1,
    });
  });
});
