import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDb, DATABASE_URL, fixtureUnits } from './testing.js';
import { HashingEmbedder, type Embedder } from './embedder.js';
import { indexUnits } from './indexer.js';
import { HybridSearch } from './search.js';
import { OverlapReranker } from './reranker.js';
import { readModelRecord, recordModel, type Pool } from './db.js';

class OtherModel extends HashingEmbedder implements Embedder {
  override readonly model = 'fake-other';
}

describe.skipIf(!DATABASE_URL)('index and hybrid search (Postgres)', () => {
  let pool: Pool;
  let drop: () => Promise<void>;
  const units = fixtureUnits();
  const embedder = new HashingEmbedder();

  beforeAll(async () => {
    ({ pool, drop } = await createTestDb());
  });
  afterAll(async () => {
    await drop();
  });

  const count = async (sql: string): Promise<number> =>
    Number((await pool.query<{ n: string }>(sql)).rows[0]!.n);

  it('stores every unit as a chunk with metadata and Stand', async () => {
    const res = await indexUnits(pool, embedder, units);
    expect(res.chunks).toBeGreaterThanOrEqual(units.length);
    expect(await count('SELECT count(DISTINCT unit_id) AS n FROM chunks')).toBe(units.length);
    const row = (
      await pool.query("SELECT * FROM chunks WHERE unit_id = 'ustg_1980/§ 14/Abs. 1' AND part = 1")
    ).rows[0];
    expect(row).toMatchObject({
      source: 'UStG',
      label: '§ 14 Abs. 1 UStG',
      url: 'https://www.gesetze-im-internet.de/ustg_1980/__14.html',
    });
    expect(row.stand).toMatch(/^zuletzt geändert/);
    expect(row.text.startsWith('(1) Rechnung ist jedes Dokument')).toBe(true);
  });

  it('is idempotent', async () => {
    const before = await count('SELECT count(*) AS n FROM chunks');
    const again = await indexUnits(pool, embedder, units);
    expect(again.embedded).toBe(0);
    expect(await count('SELECT count(*) AS n FROM chunks')).toBe(before);
    expect(await count('SELECT count(*) AS n FROM embeddings_256')).toBe(before);
  });

  it('replaces changed units and removes vanished ones', async () => {
    const [first, ...rest] = units;
    const changed = [{ ...first!, text: first!.text + ' Zusatz' }, ...rest.slice(1)];
    const res = await indexUnits(pool, embedder, changed);
    expect(res.embedded).toBe(1);
    expect(res.removed).toBeGreaterThanOrEqual(1);
    await indexUnits(pool, embedder, units);
    expect(await count('SELECT count(DISTINCT unit_id) AS n FROM chunks')).toBe(units.length);
  });

  it('splits over-long units into parts that join to the original text', async () => {
    const long = units.find((u) => u.text.length > 1500)!;
    expect(long).toBeDefined();
    const parts = (
      await pool.query<{ text: string; part: number; parts: number; path: string[] }>(
        'SELECT text, part, parts, path FROM chunks WHERE unit_id = $1 ORDER BY part',
        [long.id],
      )
    ).rows;
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.map((p) => p.part)).toEqual(parts.map((_, i) => i + 1));
    expect(parts.every((p) => p.parts === parts.length)).toBe(true);
    expect(parts.map((p) => p.text).join('')).toBe(long.text);
    expect(parts.every((p) => p.path.join('/') === long.path.join('/'))).toBe(true);
  });

  it('keeps embeddings of two models side by side', async () => {
    await indexUnits(pool, new OtherModel(), units);
    const models = (
      await pool.query<{ model: string }>(
        'SELECT DISTINCT model FROM embeddings_256 ORDER BY model',
      )
    ).rows.map((r) => r.model);
    expect(models).toEqual(['fake-hash-256', 'fake-other']);
    const hits = await new HybridSearch(pool, new OtherModel()).search('Rechnung', { limit: 3 });
    expect(hits.length).toBeGreaterThan(0);
  });

  it('returns metadata and original text for each hit', async () => {
    const hits = await new HybridSearch(pool, embedder).search(
      'Wann ist eine Rechnung auszustellen?',
      { mode: 'hybrid' },
    );
    expect(hits).toHaveLength(5);
    for (const h of hits) {
      expect(h).toMatchObject({ source: expect.any(String), label: expect.any(String) });
      expect(h.url).toMatch(/^https:\/\/www\.gesetze-im-internet\.de\//);
      expect(h.stand).toBeTruthy();
      expect(h.text.length).toBeGreaterThan(0);
    }
    expect(hits.some((h) => h.ftsRank !== null)).toBe(true);
    expect(hits.some((h) => h.vectorRank !== null)).toBe(true);
  });

  it('matches inflected forms through German full-text search', async () => {
    const hits = await new HybridSearch(pool, embedder).search('Rechnungen', {
      limit: 10,
      mode: 'hybrid',
    });
    const fts = hits.filter((h) => h.ftsRank !== null);
    expect(fts.some((h) => h.unitId.startsWith('ustg_1980/§ 14/'))).toBe(true);
  });

  it('adds known parts of a compound to the full-text query', async () => {
    const search = new HybridSearch(pool, embedder);
    const terms = await search.queryTerms('Unternehmerleistung');
    expect(terms).toEqual(['unternehmerleistung', 'unternehmer', 'leistung']);
    const hits = await search.search('Unternehmerleistung', { limit: 10, mode: 'hybrid' });
    expect(hits.some((h) => h.ftsRank !== null && h.text.includes('Unternehmer'))).toBe(true);
  });

  it('searches an unknown word unchanged without failing', async () => {
    const search = new HybridSearch(pool, embedder);
    expect(await search.queryTerms('Zzzxyzquark')).toEqual(['zzzxyzquark']);
    await expect(search.search('Zzzxyzquark')).resolves.toBeDefined();
  });

  it('vector-only mode returns no full-text ranks', async () => {
    const hits = await new HybridSearch(pool, embedder).search('Rechnung ausstellen', {
      limit: 5,
      mode: 'vector',
    });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((h) => h.ftsRank === null && h.vectorRank !== null)).toBe(true);
  });

  it('full-text-only mode returns no vector ranks and does not need the embedder', async () => {
    const failing: Embedder = {
      model: 'none',
      dimension: 256,
      embed: () => Promise.reject(new Error('embedder must not be called')),
    };
    const hits = await new HybridSearch(pool, failing).search('Rechnung ausstellen', {
      limit: 5,
      mode: 'fts',
    });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((h) => h.vectorRank === null && h.ftsRank !== null)).toBe(true);
  });

  it('can switch compound splitting off', async () => {
    const search = new HybridSearch(pool, embedder);
    expect(await search.queryTerms('Unternehmerleistung', false)).toEqual(['unternehmerleistung']);
  });

  it('does not rerank unless asked and fails clearly without a reranker', async () => {
    const plain = new HybridSearch(pool, embedder);
    await expect(plain.search('Rechnung', { rerank: true })).rejects.toThrow(/no reranker/);
    const withReranker = new HybridSearch(pool, embedder, new OverlapReranker());
    const off = await withReranker.search('Rechnung ausstellen', { limit: 5 });
    const baseline = await plain.search('Rechnung ausstellen', { limit: 5 });
    expect(off.map((h) => h.chunkId)).toEqual(baseline.map((h) => h.chunkId));
  });

  it('reranks the top candidates by the reranker score when asked', async () => {
    const search = new HybridSearch(pool, embedder, new OverlapReranker());
    const hits = await search.search('Rechnung ausstellen', { limit: 5, rerank: true });
    expect(hits).toHaveLength(5);
    const scores = hits.map((h) => h.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });

  it('records what indexing a model cost', async () => {
    await recordModel(pool, {
      model: 'fake-hash-256',
      dimension: 256,
      indexingSeconds: 12,
      weightsBytes: null,
      chunks: 5,
    });
    expect(await readModelRecord(pool, 'fake-hash-256')).toMatchObject({
      indexingSeconds: 12,
      weightsBytes: null,
    });
    expect(await readModelRecord(pool, 'unknown')).toBeNull();
  });

  it('a lower full-text weight moves the result toward vector-only order', async () => {
    const search = new HybridSearch(pool, embedder);
    const q = 'Wann ist eine Rechnung auszustellen?';
    const vectorOnly = (await search.search(q, { limit: 5, mode: 'vector' })).map((h) => h.chunkId);
    const tiny = (await search.search(q, { limit: 5, mode: 'hybrid', ftsWeight: 0.0001 })).map(
      (h) => h.chunkId,
    );
    expect(tiny).toEqual(vectorOnly);
  });

  it('drops very common query terms from the full-text query when asked', async () => {
    const search = new HybridSearch(pool, embedder);
    // "unternehmer" is in many chunks; the other word is in none, so only it survives the filter.
    const q = 'Unternehmer Zzzxyzquark';
    const all = await search.search(q, { limit: 5, mode: 'fts' });
    const strict = await search.search(q, { limit: 5, mode: 'fts', ftsMaxDocShare: 0.01 });
    expect(all.length).toBeGreaterThan(0);
    expect(strict).toHaveLength(0);
  });

  it('keeps the full query when every term would be dropped', async () => {
    const search = new HybridSearch(pool, embedder);
    const hits = await search.search('Rechnung', { limit: 5, mode: 'fts', ftsMaxDocShare: 0 });
    expect(hits.length).toBeGreaterThan(0);
  });

  it('searches hybrid with BM25 and citation matching by default', async () => {
    const hits = await new HybridSearch(pool, embedder).search('Rechnung ausstellen');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.some((h) => h.vectorRank !== null)).toBe(true);
    expect(hits.some((h) => h.ftsRank !== null)).toBe(true);
    expect(hits.every((h) => h.citationRank !== undefined)).toBe(true);
  });

  it('BM25 ranks a rare-term match first and works in hybrid mode', async () => {
    const search = new HybridSearch(pool, embedder);
    const only = await search.search('Rechnung ausstellen', {
      limit: 5,
      mode: 'fts',
      lexical: 'bm25',
    });
    expect(only.length).toBeGreaterThan(0);
    expect(only.every((h) => h.vectorRank === null && h.ftsRank !== null)).toBe(true);
    const hybrid = await search.search('Rechnung ausstellen', {
      limit: 5,
      mode: 'hybrid',
      lexical: 'bm25',
    });
    expect(hybrid.some((h) => h.ftsRank !== null)).toBe(true);
  });

  it('"and" falls back to the OR query when the strict query finds nothing', async () => {
    const search = new HybridSearch(pool, embedder);
    const q = 'Rechnung Zzzxyzquark';
    const strictOnly = await search.search(q, { limit: 5, mode: 'fts', ftsQuery: 'and' });
    expect(strictOnly.length).toBeGreaterThan(0);
  });

  it('citation matching brings the named unit into the top results', async () => {
    const search = new HybridSearch(pool, embedder);
    const hits = await search.search('Was regelt § 14 Abs. 1 UStG?', {
      limit: 3,
      citationMatch: true,
    });
    const named = hits.find((h) => h.label === '§ 14 Abs. 1 UStG');
    expect(named?.citationRank).toBe(1);
    const without = await search.search('Was regelt § 14 Abs. 1 UStG?', {
      limit: 3,
      citationMatch: false,
    });
    expect(without[0]?.citationRank).toBeUndefined();
  });

  it('citation matching adds nothing when the question names no citation', async () => {
    const search = new HybridSearch(pool, embedder);
    const a = await search.search('Wann ist eine Rechnung auszustellen?', {
      limit: 5,
      citationMatch: false,
    });
    const b = await search.search('Wann ist eine Rechnung auszustellen?', {
      limit: 5,
      citationMatch: true,
    });
    expect(b.map((h) => h.chunkId)).toEqual(a.map((h) => h.chunkId));
  });
});
