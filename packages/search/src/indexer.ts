import type { CorpusUnit } from '@normkompass/corpus';
import { chunkUnit, embeddingInput, type Chunk } from './chunking.js';
import { ensureEmbeddingTable, toVectorLiteral, type Pool } from './db.js';
import type { Embedder } from './embedder.js';

export interface IndexResult {
  chunks: number;
  embedded: number;
  removed: number;
}

export interface IndexOptions {
  embedBatchSize?: number;
  onProgress?: (done: number, total: number) => void;
}

/**
 * Stores units as chunks and embeds them with `embedder`. Safe to run repeatedly:
 * unchanged chunks are not touched, changed ones are replaced, vanished ones are removed.
 * Embeddings of other models are kept.
 */
export async function indexUnits(
  pool: Pool,
  embedder: Embedder,
  units: CorpusUnit[],
  options: IndexOptions = {},
): Promise<IndexResult> {
  const table = await ensureEmbeddingTable(pool, embedder.dimension);
  const chunks = units.flatMap((u) => chunkUnit(u));
  const documents = [...new Set(units.map((u) => u.documentId))];

  const client = await pool.connect();
  let removed: number;
  try {
    await client.query('BEGIN');
    for (const c of chunks) {
      const u = c.unit;
      await client.query(
        `INSERT INTO chunks (id, unit_id, part, parts, document_id, source, path, label, title, url, stand, kind, text, content_hash)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
         ON CONFLICT (id) DO UPDATE SET
           parts = EXCLUDED.parts, source = EXCLUDED.source, path = EXCLUDED.path, label = EXCLUDED.label,
           title = EXCLUDED.title, url = EXCLUDED.url, stand = EXCLUDED.stand, kind = EXCLUDED.kind,
           text = EXCLUDED.text, content_hash = EXCLUDED.content_hash`,
        [
          c.id,
          c.unitId,
          c.part,
          c.parts,
          u.documentId,
          u.source,
          u.path,
          u.label,
          u.title,
          u.url,
          u.stand ?? null,
          u.kind,
          c.text,
          c.contentHash,
        ],
      );
    }
    const res = await client.query(
      'DELETE FROM chunks WHERE document_id = ANY($1) AND NOT (id = ANY($2))',
      [documents, chunks.map((c) => c.id)],
    );
    removed = res.rowCount ?? 0;
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }

  const have = new Map(
    (
      await pool.query<{ chunk_id: string; content_hash: string }>(
        `SELECT chunk_id, content_hash FROM ${table} WHERE model = $1`,
        [embedder.model],
      )
    ).rows.map((r) => [r.chunk_id, r.content_hash]),
  );
  const todo: Chunk[] = chunks.filter((c) => have.get(c.id) !== c.contentHash);

  const batchSize = options.embedBatchSize ?? 32;
  for (let i = 0; i < todo.length; i += batchSize) {
    const batch = todo.slice(i, i + batchSize);
    const vectors = await embedder.embed(batch.map(embeddingInput), 'passage');
    for (const [j, c] of batch.entries()) {
      const vector = vectors[j];
      if (!vector) throw new Error('Embedder returned fewer vectors than inputs');
      await pool.query(
        `INSERT INTO ${table} (chunk_id, model, content_hash, embedding) VALUES ($1,$2,$3,$4::vector)
         ON CONFLICT (chunk_id, model) DO UPDATE SET content_hash = EXCLUDED.content_hash, embedding = EXCLUDED.embedding`,
        [c.id, embedder.model, c.contentHash, toVectorLiteral(vector)],
      );
    }
    options.onProgress?.(Math.min(i + batchSize, todo.length), todo.length);
  }
  return { chunks: chunks.length, embedded: todo.length, removed };
}
