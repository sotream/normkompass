import { join } from 'node:path';

/** Turns text into vectors. `kind` lets models with asymmetric prefixes tell queries from passages. */
export interface Embedder {
  /** Model name; embeddings are stored and searched per model name. */
  readonly model: string;
  readonly dimension: number;
  embed(texts: string[], kind: 'query' | 'passage'): Promise<number[][]>;
}

const normalize = (v: number[]): number[] => {
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => x / norm);
};

/**
 * Deterministic embedder for tests and CI: hashed character trigrams of lower-cased words.
 * Similar spellings give similar vectors, which is enough to exercise ranking without a model.
 */
export class HashingEmbedder implements Embedder {
  readonly model: string = 'fake-hash-256';
  readonly dimension = 256;

  embed(texts: string[]): Promise<number[][]> {
    return Promise.resolve(texts.map((t) => this.vector(t)));
  }

  private vector(text: string): number[] {
    const v = new Array<number>(this.dimension).fill(0);
    for (const word of text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []) {
      const padded = `^${word}$`;
      for (let i = 0; i + 3 <= padded.length; i++) {
        let h = 2166136261;
        for (const ch of padded.slice(i, i + 3)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
        const slot = (h >>> 0) % this.dimension;
        v[slot] = (v[slot] ?? 0) + 1;
      }
    }
    return normalize(v);
  }
}

export interface LocalE5Options {
  /** Where the model files are cached; keep it outside git. */
  cacheDir?: string;
  batchSize?: number;
}

/**
 * Multilingual E5 (small) running locally through transformers.js; no data leaves the machine
 * after the one-time model download. E5 expects "query: " / "passage: " prefixes.
 */
export class LocalE5Embedder implements Embedder {
  readonly model = 'multilingual-e5-small';
  readonly dimension = 384;
  private extractor:
    Promise<(texts: string[], opts: object) => Promise<{ data: Float32Array }>> | undefined;

  constructor(private readonly options: LocalE5Options = {}) {}

  private load() {
    this.extractor ??= (async () => {
      const { pipeline, env } = await import('@huggingface/transformers');
      env.cacheDir = this.options.cacheDir ?? join(process.cwd(), '.cache', 'models');
      const p = await pipeline('feature-extraction', 'Xenova/multilingual-e5-small', {
        dtype: 'q8',
      });
      return p as unknown as (texts: string[], opts: object) => Promise<{ data: Float32Array }>;
    })();
    return this.extractor;
  }

  async embed(texts: string[], kind: 'query' | 'passage'): Promise<number[][]> {
    const extractor = await this.load();
    const batchSize = this.options.batchSize ?? 16;
    const out: number[][] = [];
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize).map((t) => `${kind}: ${t}`);
      const res = await extractor(batch, { pooling: 'mean', normalize: true });
      for (let j = 0; j < batch.length; j++) {
        out.push(Array.from(res.data.slice(j * this.dimension, (j + 1) * this.dimension)));
      }
    }
    return out;
  }
}

export type EmbedderName = 'local-e5' | 'fake';

export function createEmbedder(name: string | undefined): Embedder {
  if (name === 'fake') return new HashingEmbedder();
  if (name === undefined || name === 'local-e5') return new LocalE5Embedder();
  throw new Error(`Unknown embedder "${name}" (expected "local-e5" or "fake")`);
}
