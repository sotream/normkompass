import { describe, expect, it } from 'vitest';
import { Bm25 } from './bm25.js';

const doc = (id: string, terms: Record<string, number>) => ({
  id,
  terms: new Map(Object.entries(terms)),
});

describe('Bm25', () => {
  const index = new Bm25([
    doc('common-only', { unternehm: 6, rechnung: 1 }),
    doc('rare', { unternehm: 1, gelangensbestatig: 1 }),
    doc('other', { steuer: 3 }),
    doc('filler1', { unternehm: 1 }),
    doc('filler2', { unternehm: 1 }),
  ]);

  it('ranks a rare-term match above a chunk that only repeats a common term', () => {
    const hits = index.search(['unternehm', 'gelangensbestatig'], 5);
    expect(hits[0]?.id).toBe('rare');
    expect(hits.map((h) => h.id)).toContain('common-only');
  });

  it('returns only documents that match a term, best first, and respects the limit', () => {
    const hits = index.search(['unternehm'], 2);
    expect(hits).toHaveLength(2);
    expect(hits.every((h) => h.id !== 'other')).toBe(true);
    expect(index.search(['unbekannt'], 5)).toEqual([]);
  });

  it('discounts long documents for the same term frequency', () => {
    const long = new Bm25([
      doc('short', { gelangens: 1, a: 1 }),
      doc('long', { gelangens: 1, a: 1, b: 40, c: 40 }),
      doc('x', { z: 1 }),
    ]);
    expect(long.search(['gelangens'], 2).map((h) => h.id)).toEqual(['short', 'long']);
  });

  it('handles an empty collection and repeated query terms', () => {
    expect(new Bm25([]).search(['a'], 3)).toEqual([]);
    expect(index.search(['gelangensbestatig', 'gelangensbestatig'], 3)).toEqual(
      index.search(['gelangensbestatig'], 3),
    );
  });
});
