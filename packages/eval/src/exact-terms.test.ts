import { describe, expect, it } from 'vitest';
import { componentRank, fusedRank, outranking, reciprocal, type RankedHit } from './exact-terms.js';

const hit = (unitId: string, vectorRank: number | null, ftsRank: number | null): RankedHit => ({
  unitId,
  vectorRank,
  ftsRank,
});
const hits = [hit('x/§ 1/Abs. 1', 3, 1), hit('x/§ 2/Abs. 1', 1, null), hit('x/§ 3/Abs. 2', 2, 2)];

describe('exact-term ranks', () => {
  it('finds the fused position of the expected unit, counting its parent as a hit', () => {
    expect(fusedRank(hits, ['x/§ 3/Abs. 2'])).toBe(3);
    expect(fusedRank([hit('x/§ 5', 1, null)], ['x/§ 5/Abs. 1'])).toBe(1);
    expect(fusedRank(hits, ['x/§ 9/Abs. 1'])).toBeNull();
  });

  it('reads the rank inside one component and null when absent from it', () => {
    expect(componentRank(hits, ['x/§ 3/Abs. 2'], 'ftsRank')).toBe(2);
    expect(componentRank(hits, ['x/§ 3/Abs. 2'], 'vectorRank')).toBe(2);
    expect(componentRank(hits, ['x/§ 2/Abs. 1'], 'ftsRank')).toBeNull();
  });

  it('lists what a component ranks above the expected unit, best first', () => {
    expect(outranking(hits, ['x/§ 3/Abs. 2'], 'ftsRank')).toEqual(['x/§ 1/Abs. 1']);
    expect(outranking(hits, ['x/§ 3/Abs. 2'], 'vectorRank')).toEqual(['x/§ 2/Abs. 1']);
    expect(outranking(hits, ['x/§ 1/Abs. 1'], 'ftsRank')).toEqual([]);
  });

  it('turns a rank into a reciprocal rank', () => {
    expect(reciprocal(4)).toBe(0.25);
    expect(reciprocal(null)).toBe(0);
  });
});

import { separatedNumbers, spearman } from './exact-terms.js';

describe('spearman', () => {
  it('is 1 for the same order, -1 for the reverse, and handles ties', () => {
    expect(spearman([1, 2, 3, 4], [10, 20, 30, 40])).toBeCloseTo(1);
    expect(spearman([1, 2, 3, 4], [40, 30, 20, 10])).toBeCloseTo(-1);
    expect(spearman([1, 1, 2, 2], [1, 1, 2, 2])).toBeCloseTo(1);
    expect(spearman([1, 2, 3], [5, 5, 5])).toBe(0);
    expect(spearman([1, 2], [1, 2])).toBe(0);
  });
});

describe('separatedNumbers', () => {
  it('finds numbers with separators and not plain ones or spaced groups', () => {
    expect(
      separatedNumbers('mehr als 6.000 Kilometer, 30,5 Prozent, 600 000 Euro, 15 Jahre'),
    ).toEqual(['6.000', '30,5']);
  });
});
