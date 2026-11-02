import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import pg from 'pg';

export type Pool = pg.Pool;

export interface PoolOptions {
  connectionString: string;
  /** Postgres schema to work in; created if missing. Defaults to "public". */
  schema?: string;
}

const SAFE_IDENT = /^[a-z_][a-z0-9_]*$/;

export function createPool({ connectionString, schema = 'public' }: PoolOptions): Pool {
  if (!SAFE_IDENT.test(schema)) throw new Error(`Invalid schema name "${schema}"`);
  // The pgvector extension lives in "public", so keep it on the search path.
  return new pg.Pool({ connectionString, max: 4, options: `-c search_path=${schema},public` });
}

const MIGRATIONS_DIR = join(import.meta.dirname, '..', 'migrations');

/** Applies SQL files from `migrations/` once each, in file name order. */
export async function migrate(pool: Pool, schema = 'public'): Promise<void> {
  if (!SAFE_IDENT.test(schema)) throw new Error(`Invalid schema name "${schema}"`);
  const client = await pool.connect();
  try {
    await client.query(`CREATE SCHEMA IF NOT EXISTS ${schema}`);
    await client.query(`SET search_path TO ${schema}, public`);
    await client.query(
      'CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())',
    );
    const applied = new Set(
      (await client.query<{ name: string }>('SELECT name FROM schema_migrations')).rows.map(
        (r) => r.name,
      ),
    );
    const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort();
    for (const file of files) {
      if (applied.has(file)) continue;
      const sql = await readFile(join(MIGRATIONS_DIR, file), 'utf-8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      }
    }
  } finally {
    client.release();
  }
}

/** One embeddings table per vector dimension, so pgvector columns stay typed. */
export async function ensureEmbeddingTable(pool: Pool, dimension: number): Promise<string> {
  if (!Number.isInteger(dimension) || dimension < 1 || dimension > 4000) {
    throw new Error(`Invalid embedding dimension ${dimension}`);
  }
  const table = `embeddings_${dimension}`;
  await pool.query(`CREATE TABLE IF NOT EXISTS ${table} (
    chunk_id     text NOT NULL REFERENCES chunks(id) ON DELETE CASCADE,
    model        text NOT NULL,
    content_hash text NOT NULL,
    embedding    vector(${dimension}) NOT NULL,
    PRIMARY KEY (chunk_id, model)
  )`);
  return table;
}

export const toVectorLiteral = (v: number[]): string => `[${v.join(',')}]`;

export interface ModelRecord {
  model: string;
  dimension: number;
  /** Seconds the last full indexing run took; null if it was not measured. */
  indexingSeconds: number | null;
  /** Size of the model weights on disk; null for models without local weights. */
  weightsBytes: number | null;
  chunks: number;
}

/** Remembers what indexing with a model cost, so the eval can report it next to the quality numbers. */
export async function recordModel(pool: Pool, record: ModelRecord): Promise<void> {
  await pool.query(
    `INSERT INTO embedding_models (model, dimension, indexing_seconds, weights_bytes, chunks)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (model) DO UPDATE SET dimension = EXCLUDED.dimension,
       indexing_seconds = EXCLUDED.indexing_seconds, weights_bytes = EXCLUDED.weights_bytes,
       chunks = EXCLUDED.chunks, indexed_at = now()`,
    [record.model, record.dimension, record.indexingSeconds, record.weightsBytes, record.chunks],
  );
}

export async function readModelRecord(pool: Pool, model: string): Promise<ModelRecord | null> {
  const res = await pool.query<{
    model: string;
    dimension: number;
    indexing_seconds: number | null;
    weights_bytes: string | null;
    chunks: number;
  }>('SELECT * FROM embedding_models WHERE model = $1', [model]);
  const r = res.rows[0];
  if (!r) return null;
  return {
    model: r.model,
    dimension: r.dimension,
    indexingSeconds: r.indexing_seconds,
    weightsBytes: r.weights_bytes === null ? null : Number(r.weights_bytes),
    chunks: r.chunks,
  };
}
