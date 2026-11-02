import { describe, expect, it } from 'vitest';
import { Vocabulary, expandQueryTerms, splitCompound } from './compound.js';

const vocab = Vocabulary.fromTexts([
  'Die Umsatzsteuer wird in der Voranmeldung erklärt.',
  'Der Rechnungsbetrag und die Rechnung, der Betrag, die Steuer.',
]);

describe('splitCompound', () => {
  it('splits a compound into known parts', () => {
    expect(splitCompound('Umsatzsteuervoranmeldung', vocab)).toEqual([
      'umsatzsteuer',
      'voranmeldung',
    ]);
  });

  it('handles linking elements', () => {
    const v = Vocabulary.fromTexts(['Rechnung Betrag']);
    expect(splitCompound('Rechnungsbetrag', v)).toEqual(['rechnung', 'betrag']);
  });

  it('returns nothing for words that cannot be split completely', () => {
    expect(splitCompound('Umsatzsteuerquatschung', vocab)).toEqual([]);
  });

  it('returns nothing for a word that is already a single known word', () => {
    expect(splitCompound('Umsatzsteuer', vocab)).toEqual([]);
  });
});

describe('expandQueryTerms', () => {
  it('adds parts of compounds and keeps the original words', () => {
    expect(expandQueryTerms('Wann ist die Umsatzsteuervoranmeldung fällig?', vocab)).toEqual([
      'wann',
      'ist',
      'die',
      'umsatzsteuervoranmeldung',
      'umsatzsteuer',
      'voranmeldung',
      'fällig',
    ]);
  });

  it('searches unknown words unchanged and drops duplicates', () => {
    expect(expandQueryTerms('Zzzxyzquark Zzzxyzquark', vocab)).toEqual(['zzzxyzquark']);
  });
});
