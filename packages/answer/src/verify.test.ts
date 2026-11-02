import { describe, expect, it } from 'vitest';
import { makeHit } from './test-hits.js';
import type { Source } from './types.js';
import { verifyCitations } from './verify.js';

const sources: Source[] = [
  {
    number: 1,
    hit: makeHit({ text: '(1) Rechnung ist jedes Dokument, mit dem abgerechnet wird.' }),
  },
  {
    number: 2,
    hit: makeHit({
      unitId: 'ustg_1980/§ 14/Abs. 2',
      path: ['§ 14', 'Abs. 2'],
      text: '(2) Der Unternehmer ist zur Ausstellung einer Rechnung berechtigt.',
    }),
  },
];

describe('verifyCitations', () => {
  it('accepts an exact quote', () => {
    const r = verifyCitations([{ chunk: 1, quote: 'Rechnung ist jedes Dokument' }], sources);
    expect(r.valid).toHaveLength(1);
    expect(r.rejected).toEqual([]);
  });

  it('rejects a quote that differs by one word', () => {
    const r = verifyCitations([{ chunk: 1, quote: 'Rechnung ist jedes Schriftstück' }], sources);
    expect(r.valid).toEqual([]);
    expect(r.rejected[0]?.reason).toBe('quote-not-found');
  });

  it('rejects a quote that exists only in another chunk', () => {
    const r = verifyCitations(
      [{ chunk: 1, quote: 'zur Ausstellung einer Rechnung berechtigt' }],
      sources,
    );
    expect(r.rejected[0]?.reason).toBe('quote-not-found');
  });

  it('is exact about whitespace and case', () => {
    expect(verifyCitations([{ chunk: 1, quote: 'Rechnung  ist' }], sources).rejected).toHaveLength(
      1,
    );
    expect(verifyCitations([{ chunk: 1, quote: 'rechnung ist' }], sources).rejected).toHaveLength(
      1,
    );
  });

  it('rejects empty and blank quotes', () => {
    expect(verifyCitations([{ chunk: 1, quote: '' }], sources).rejected[0]?.reason).toBe(
      'empty-quote',
    );
    expect(verifyCitations([{ chunk: 1, quote: '   ' }], sources).rejected[0]?.reason).toBe(
      'empty-quote',
    );
  });

  it('rejects a chunk number that was not provided', () => {
    const r = verifyCitations([{ chunk: 9, quote: 'Rechnung' }], sources);
    expect(r.rejected[0]?.reason).toBe('unknown-chunk');
  });

  it('separates valid from rejected citations', () => {
    const r = verifyCitations(
      [
        { chunk: 1, quote: 'Rechnung ist jedes Dokument' },
        { chunk: 2, quote: 'erfundener Satz' },
      ],
      sources,
    );
    expect(r.valid).toHaveLength(1);
    expect(r.rejected).toHaveLength(1);
  });
});
