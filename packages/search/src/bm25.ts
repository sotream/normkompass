/** A document as a bag of terms (normalized lexemes) with their frequencies. */
export interface Bm25Doc {
  id: string;
  terms: Map<string, number>;
}

export interface Bm25Options {
  k1?: number;
  b?: number;
}

/**
 * Okapi BM25 over a small in-memory collection: a term's weight grows with how rare it is across documents
 * and saturates with its frequency in a document, and long documents are discounted. This is built for a
 * corpus of a few thousand chunks and makes no claim about larger ones.
 */
export class Bm25 {
  private readonly postings = new Map<string, { doc: number; tf: number }[]>();
  private readonly lengths: number[] = [];
  private readonly ids: string[] = [];
  private readonly avgLength: number;
  private readonly k1: number;
  private readonly b: number;

  constructor(docs: Bm25Doc[], options: Bm25Options = {}) {
    this.k1 = options.k1 ?? 1.2;
    this.b = options.b ?? 0.75;
    let total = 0;
    docs.forEach((d, index) => {
      let length = 0;
      for (const [term, tf] of d.terms) {
        length += tf;
        const list = this.postings.get(term) ?? [];
        list.push({ doc: index, tf });
        this.postings.set(term, list);
      }
      this.lengths.push(length);
      this.ids.push(d.id);
      total += length;
    });
    this.avgLength = docs.length === 0 ? 0 : total / docs.length;
  }

  get size(): number {
    return this.ids.length;
  }

  private idf(df: number): number {
    return Math.log(1 + (this.ids.length - df + 0.5) / (df + 0.5));
  }

  /** The best `limit` documents for the query terms, best first; documents with no matching term are not returned. */
  search(queryTerms: string[], limit: number): { id: string; score: number }[] {
    const scores = new Map<number, number>();
    for (const term of new Set(queryTerms)) {
      const list = this.postings.get(term);
      if (!list) continue;
      const idf = this.idf(list.length);
      for (const { doc, tf } of list) {
        const norm = 1 - this.b + (this.b * (this.lengths[doc] ?? 0)) / (this.avgLength || 1);
        const part = (idf * tf * (this.k1 + 1)) / (tf + this.k1 * norm);
        scores.set(doc, (scores.get(doc) ?? 0) + part);
      }
    }
    return [...scores]
      .map(([doc, score]) => ({ id: this.ids[doc] ?? '', score }))
      .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
      .slice(0, limit);
  }
}
