import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  DATABASE_URL,
  HashingEmbedder,
  HybridSearch,
  createTestDb,
  indexUnits,
  type Pool,
} from '@normkompass/search';
import type { CorpusUnit } from '@normkompass/corpus';
import { TextFolderSource } from './text-folder-source.js';

const DOCS = join(import.meta.dirname, '..', 'docs');

async function loadUnits(): Promise<CorpusUnit[]> {
  const source = new TextFolderSource(DOCS);
  const units: CorpusUnit[] = [];
  for await (const doc of source.loadDocuments()) units.push(...source.split(doc).units);
  return units;
}

describe('own-corpus example: adapter', () => {
  it('turns each section of each file into one citable unit', async () => {
    const units = await loadUnits();
    expect(units).toHaveLength(9);
    const unit = units.find((u) => u.id === 'urlaub/Urlaubsanspruch');
    expect(unit).toMatchObject({
      source: 'urlaub',
      path: ['Urlaubsanspruch'],
      label: 'Urlaubsanspruch (urlaub)',
      kind: 'norm',
    });
    expect(unit?.text).toContain('30 Urlaubstage');
    expect(new Set(units.map((u) => u.id)).size).toBe(units.length);
  });
});

describe.skipIf(!DATABASE_URL)('own-corpus example: index and search (Postgres)', () => {
  let pool: Pool;
  let drop: () => Promise<void>;
  beforeAll(async () => {
    ({ pool, drop } = await createTestDb());
  });
  afterAll(async () => {
    await drop();
  });

  it('indexes the folder and answers a retrieval query from it', async () => {
    const embedder = new HashingEmbedder();
    const result = await indexUnits(pool, embedder, await loadUnits());
    expect(result.chunks).toBe(9);
    const hits = await new HybridSearch(pool, embedder).search('Wie viele Urlaubstage habe ich?', {
      limit: 3,
    });
    expect(hits[0]?.unitId).toBe('urlaub/Urlaubsanspruch');
    expect(hits[0]?.url).toBe('file:urlaub.txt');
  });
});
