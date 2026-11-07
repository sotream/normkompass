/** Words of the corpus, lower-cased; used to split German compounds in queries. */
export class Vocabulary {
  private readonly words: Set<string>;

  constructor(words: Iterable<string>) {
    this.words = new Set(words);
  }

  static fromTexts(texts: Iterable<string>, minLength = 4): Vocabulary {
    const words = new Set<string>();
    for (const text of texts) {
      for (const w of text.toLowerCase().match(/\p{L}+/gu) ?? []) {
        if (w.length >= minLength) words.add(w);
      }
    }
    return new Vocabulary(words);
  }

  has(word: string): boolean {
    return this.words.has(word);
  }

  get size(): number {
    return this.words.size;
  }
}

const LINKING = ['', 's', 'es', 'n', 'en', 'e', 'er'];
const MIN_PART = 4;

/**
 * Splits a compound into parts that all occur in the vocabulary, allowing the linking
 * elements German inserts between parts ("Umsatzsteuer|voranmeldung", "Rechnung|s|betrag").
 * Prefers the split with the fewest parts. Returns [] if no complete split exists.
 */
export function splitCompound(word: string, vocab: Vocabulary): string[] {
  const w = word.toLowerCase();
  const best = new Array<string[] | null>(w.length + 1).fill(null);
  best[0] = [];
  for (let end = MIN_PART; end <= w.length; end++) {
    for (let start = 0; start + MIN_PART <= end; start++) {
      const prev = best[start];
      if (!prev) continue;
      const piece = w.slice(start, end);
      for (const link of LINKING) {
        if (link && !piece.endsWith(link)) continue;
        const stem = link ? piece.slice(0, -link.length) : piece;
        if (stem.length < MIN_PART || !vocab.has(stem)) continue;
        const candidate = [...prev, stem];
        const current = best[end];
        if (!current || candidate.length < current.length) best[end] = candidate;
        break;
      }
    }
  }
  const result = best[w.length] ?? [];
  return result.length >= 2 ? result : [];
}

const WORD = /[\p{L}\p{N}]+/gu;
const SEPARATED_OR_WORD = /\d{1,3}(?:[.,]\d{1,3})+(?![\p{L}\p{N}])|[\p{L}\p{N}]+/gu;

/** Words of a question, plus the parts of any compound that splits into known words. */
export function expandQueryTerms(
  question: string,
  vocab: Vocabulary,
  options: { keepSeparatedNumbers?: boolean } = {},
): string[] {
  const terms: string[] = [];
  const seen = new Set<string>();
  const add = (t: string): void => {
    if (!seen.has(t)) {
      seen.add(t);
      terms.push(t);
    }
  };
  // With keepSeparatedNumbers a number such as "6.000" or "30,5" stays one term, as it is one word in the index.
  const tokens = options.keepSeparatedNumbers ? SEPARATED_OR_WORD : WORD;
  for (const raw of question.match(tokens) ?? []) {
    const word = raw.toLowerCase();
    add(word);
    if (word.length >= 2 * MIN_PART) {
      for (const part of splitCompound(word, vocab)) add(part);
    }
  }
  return terms;
}
