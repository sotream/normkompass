import { describe, expect, it } from 'vitest';
import { aggregate, isHit, scoreQuestion } from './metrics.js';
import type { Question } from './questions.js';

const q = (expected: string[]): Question => ({
  id: 'q',
  question: '?',
  answerable: true,
  expected,
  source: 's',
  needs_review: false,
});

describe('isHit', () => {
  it('accepts the expected unit and its ancestors only', () => {
    const e = 'ustg_1980/§ 14/Abs. 2/Nr. 1';
    expect(isHit(e, e)).toBe(true);
    expect(isHit('ustg_1980/§ 14/Abs. 2', e)).toBe(true);
    expect(isHit('ustg_1980/§ 14', e)).toBe(true);
    expect(isHit('ustg_1980/§ 14/Abs. 1', e)).toBe(false);
    expect(isHit('ustg_1980/§ 14/Abs. 2/Nr. 1/x', e)).toBe(false);
  });

  it('does not treat a longer sibling name as a parent', () => {
    expect(isHit('ustg_1980/§ 1', 'ustg_1980/§ 14/Abs. 1')).toBe(false);
  });
});

describe('scoreQuestion', () => {
  it('scores a first-place hit as 1 and 1', () => {
    const r = scoreQuestion(q(['a/§ 1/Abs. 1']), ['a/§ 1/Abs. 1', 'a/§ 2/Abs. 1']);
    expect(r).toMatchObject({ recallAt5: 1, reciprocalRank: 1, firstHitRank: 1 });
  });

  it('scores a miss as 0 and 0', () => {
    const r = scoreQuestion(q(['a/§ 1/Abs. 1']), ['a/§ 2/Abs. 1', 'a/§ 3/Abs. 1']);
    expect(r).toMatchObject({ recallAt5: 0, reciprocalRank: 0, firstHitRank: null });
  });

  it('uses reciprocal rank of the first hit and ignores hits beyond rank 5 for recall', () => {
    const returned = ['x/1', 'x/2', 'x/3', 'x/4', 'x/5', 'a/§ 1/Abs. 1'];
    const r = scoreQuestion(q(['a/§ 1/Abs. 1']), returned);
    expect(r.reciprocalRank).toBeCloseTo(1 / 6);
    expect(r.recallAt5).toBe(0);
    expect(r.firstHitRank).toBe(6);
  });

  it('counts the fraction of expected norms found in the top 5', () => {
    const r = scoreQuestion(q(['a/§ 1/Abs. 1', 'a/§ 9/Abs. 1']), ['a/§ 1/Abs. 1', 'a/§ 5/Abs. 1']);
    expect(r.recallAt5).toBe(0.5);
  });

  it('counts a unit once even if several of its parts are returned', () => {
    const r = scoreQuestion(q(['a/§ 1']), ['a/§ 2', 'a/§ 2', 'a/§ 1']);
    expect(r.firstHitRank).toBe(2);
  });
});

describe('aggregate', () => {
  it('is 1.0 / 1.0 when every expected norm is ranked first', () => {
    const results = [
      scoreQuestion(q(['a/§ 1']), ['a/§ 1']),
      scoreQuestion(q(['a/§ 2/Abs. 1']), ['a/§ 2/Abs. 1']),
    ];
    expect(aggregate(results)).toEqual({ questions: 2, recallAt5: 1, mrr: 1 });
  });

  it('averages hits and misses', () => {
    const results = [scoreQuestion(q(['a/§ 1']), ['a/§ 1']), scoreQuestion(q(['a/§ 2']), ['b'])];
    expect(aggregate(results)).toEqual({ questions: 2, recallAt5: 0.5, mrr: 0.5 });
  });

  it('handles an empty result list', () => {
    expect(aggregate([])).toEqual({ questions: 0, recallAt5: 0, mrr: 0 });
  });
});
