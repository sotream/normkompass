import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { CorpusUnit } from '@normkompass/corpus';
import { createTestDb, DATABASE_URL } from './testing.js';
import { HashingEmbedder } from './embedder.js';
import { indexUnits } from './indexer.js';
import { HybridSearch } from './search.js';
import type { Pool } from './db.js';

const unit = (n: number, title: string, text: string): CorpusUnit => ({
  id: `x/§ ${n}`,
  source: 'X',
  documentId: 'x',
  path: [`§ ${n}`],
  label: `§ ${n} X`,
  title,
  url: `https://example.test/${n}`,
  text,
  kind: 'norm',
});

const filler =
  'Dieser Satz füllt den Absatz mit allgemeinem Text ohne besondere Bedeutung. '.repeat(12);
// Both mention the rare word once; the first is long, the second short.
const units = [
  unit(1, 'Lang', `${filler}Das Wort Seltenwort kommt hier einmal vor. ${filler}`),
  unit(2, 'Kurz', 'Das Wort Seltenwort kommt hier einmal vor.'),
  unit(3, 'Zahl', 'Ein Landfahrzeug gilt als neu bis 6.000 Kilometer.'),
  unit(4, 'Andere', 'Eine Laufleistung von 600 Kilometer wird nicht gesondert geregelt.'),
];

describe.skipIf(!DATABASE_URL)('lexical options (Postgres)', () => {
  let pool: Pool;
  let drop: () => Promise<void>;
  const embedder = new HashingEmbedder();

  beforeAll(async () => {
    ({ pool, drop } = await createTestDb());
    await indexUnits(pool, embedder, units);
  });
  afterAll(async () => {
    await drop();
  });

  const bm25 = (question: string, extra = {}): Promise<{ unitId: string }[]> =>
    new HybridSearch(pool, embedder).search(question, {
      mode: 'fts',
      lexical: 'bm25',
      citationMatch: false,
      ...extra,
    });

  it('a number with a separator finds its unit by default and nothing when split into digit groups', async () => {
    expect((await bm25('6.000')).map((h) => h.unitId)).toEqual(['x/§ 3']);
    expect(await bm25('6.000', { keepSeparatedNumbers: false })).toEqual([]);
  });

  it('keeping separated numbers does not change a question without one', async () => {
    const a = await bm25('Seltenwort', { keepSeparatedNumbers: false });
    const b = await bm25('Seltenwort');
    expect(b.map((h) => h.unitId)).toEqual(a.map((h) => h.unitId));
  });

  it('the older full-text query also accepts numbers with a separator without failing', async () => {
    const hits = await new HybridSearch(pool, embedder).search('Kilometer 6.000 und 30,5', {
      mode: 'fts',
      lexical: 'fts',
      citationMatch: false,
    });
    expect(hits.length).toBeGreaterThan(0);
  });

  it('a lower length normalization discounts the long unit less', async () => {
    const rankOfLong = async (b?: number): Promise<number> => {
      const hits = await bm25('Seltenwort', b === undefined ? {} : { bm25B: b });
      return hits.findIndex((h) => h.unitId === 'x/§ 1');
    };
    expect(await rankOfLong()).toBe(1); // default b = 0.75: the short unit first
    expect(await rankOfLong(0)).toBe(0); // no length normalization: tie, broken by id, long first
  });
});
