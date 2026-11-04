import { describe, expect, it } from 'vitest';
import { labelMatches, parseCitations } from './citation.js';

describe('parseCitations', () => {
  it('reads section, Absatz and law', () => {
    expect(parseCitations('Was regelt § 14 Abs. 1 UStG?')).toEqual([
      { section: '14', absatz: '1', law: 'UStG' },
    ]);
  });

  it('reads letter suffixes, the long form of Absatz and a missing law', () => {
    expect(parseCitations('Gilt § 18 Absatz 4c und § 3a?')).toEqual([
      { section: '18', absatz: '4c', law: null },
      { section: '3a', absatz: null, law: null },
    ]);
  });

  it('ignores Satz and Nummer details and finds nothing in a plain question', () => {
    expect(parseCitations('Nach § 6 Absatz 1 Satz 1 Nummer 3 des Gesetzes')).toEqual([
      { section: '6', absatz: '1', law: null },
    ]);
    expect(parseCitations('Was ist eine Rechnung?')).toEqual([]);
  });
});

describe('labelMatches', () => {
  it('matches exact Absatz and law', () => {
    const ref = { section: '14', absatz: '1', law: 'UStG' };
    expect(labelMatches('§ 14 Abs. 1 UStG', ref)).toBe(true);
    expect(labelMatches('§ 14 Abs. 2 UStG', ref)).toBe(false);
    expect(labelMatches('§ 14 Abs. 1 AO', ref)).toBe(false);
    expect(labelMatches('§ 140 Abs. 1 UStG', ref)).toBe(false);
  });

  it('matches every law and every Absatz when they are not named, and Nummer labels', () => {
    expect(labelMatches('§ 3a Abs. 8 UStG', { section: '3a', absatz: null, law: null })).toBe(true);
    expect(labelMatches('§ 3a Abs. 8 UStG', { section: '3a', absatz: null, law: 'AO' })).toBe(
      false,
    );
    expect(labelMatches('§ 14 Abs. 2 Nr. 1 UStG', { section: '14', absatz: '2', law: null })).toBe(
      true,
    );
  });
});
