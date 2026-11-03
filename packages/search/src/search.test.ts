import { describe, expect, it } from 'vitest';
import { HashingEmbedder } from './embedder.js';
import { rrfMerge } from './search.js';

describe('rrfMerge', () => {
  it('keeps items found by only one list and rewards items found by both', () => {
    const scores = rrfMerge([
      [
        { id: 'vector-only', rank: 1 },
        { id: 'both', rank: 2 },
      ],
      [
        { id: 'fts-only', rank: 1 },
        { id: 'both', rank: 2 },
      ],
    ]);
    expect([...scores.keys()].sort()).toEqual(['both', 'fts-only', 'vector-only']);
    expect(scores.get('both')).toBeCloseTo(2 / 62);
    expect(scores.get('both')!).toBeGreaterThan(scores.get('vector-only')!);
  });
});

describe('HashingEmbedder', () => {
  it('is deterministic, normalized, and favors similar spelling', async () => {
    const e = new HashingEmbedder();
    const [a, b, c] = await e.embed([
      'Rechnung ausstellen',
      'Rechnungen ausstellen',
      'Mietvertrag kündigen',
    ]);
    const again = await e.embed(['Rechnung ausstellen']);
    expect(again[0]).toEqual(a);
    const dot = (x: number[], y: number[]) => x.reduce((s, v, i) => s + v * y[i]!, 0);
    expect(dot(a!, a!)).toBeCloseTo(1);
    expect(dot(a!, b!)).toBeGreaterThan(dot(a!, c!));
    expect(a).toHaveLength(e.dimension);
  });
});

describe('weighted rrfMerge', () => {
  const vector = [
    { id: 'a', rank: 1 },
    { id: 'b', rank: 2 },
  ];
  const fts = [
    { id: 'b', rank: 1 },
    { id: 'a', rank: 2 },
  ];

  it('treats both lists equally by default', () => {
    const s = rrfMerge([vector, fts]);
    expect(s.get('a')).toBeCloseTo(s.get('b') ?? 0);
  });

  it('lets a lower full-text weight keep the vector order', () => {
    const s = rrfMerge([vector, fts], 60, [1, 0.25]);
    expect(s.get('a') ?? 0).toBeGreaterThan(s.get('b') ?? 0);
  });

  it('lets a higher full-text weight flip it', () => {
    const s = rrfMerge([vector, fts], 60, [1, 4]);
    expect(s.get('b') ?? 0).toBeGreaterThan(s.get('a') ?? 0);
  });
});
