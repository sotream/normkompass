import { describe, expect, it } from 'vitest';
import { pairedBootstrap, reciprocalRanks } from './compare.js';

describe('pairedBootstrap', () => {
  it('finds no difference between identical systems', () => {
    const scores = [1, 0.5, 0, 1, 0.25, 1, 0, 0.5];
    const r = pairedBootstrap(scores, scores);
    expect(r).toMatchObject({ meanDiff: 0, lo: 0, hi: 0, significant: false });
  });

  it('calls a consistent improvement significant', () => {
    const a = Array.from({ length: 40 }, () => 0.5);
    const b = a.map((x, i) => x + 0.2 + (i % 3) * 0.01);
    const r = pairedBootstrap(a, b);
    expect(r.meanDiff).toBeGreaterThan(0.2);
    expect(r.lo).toBeGreaterThan(0);
    expect(r.significant).toBe(true);
  });

  it('does not call a mixed, small difference significant', () => {
    const a = [1, 0, 1, 0, 1, 0, 1, 0, 1, 0];
    const b = [0, 1, 1, 0, 1, 1, 0, 0, 1, 0];
    const r = pairedBootstrap(a, b);
    expect(r.lo).toBeLessThan(0);
    expect(r.hi).toBeGreaterThan(0);
    expect(r.significant).toBe(false);
  });

  it('is repeatable and checks its input', () => {
    const a = [1, 0, 0.5, 0.25];
    const b = [0.5, 0.5, 1, 0];
    expect(pairedBootstrap(a, b)).toEqual(pairedBootstrap(a, b));
    expect(() => pairedBootstrap([1], [1, 2])).toThrow(/same, non-empty/);
    expect(() => pairedBootstrap([], [])).toThrow();
  });
});

describe('reciprocalRanks', () => {
  it('maps first-hit ranks to reciprocal ranks, 0 for a miss', () => {
    expect(
      reciprocalRanks([{ firstHitRank: 1 }, { firstHitRank: 4 }, { firstHitRank: null }]),
    ).toEqual([1, 0.25, 0]);
  });
});
