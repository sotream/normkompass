import { stat } from 'node:fs/promises';
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

export interface LocalModelSpec {
  /** Name used in the CLI (`EMBEDDER`) and stored with the embeddings. */
  name: string;
  /** Hugging Face repository with ONNX weights that transformers.js can load. */
  repo: string;
  dimension: number;
  pooling: 'mean' | 'cls';
  /** Text prefixes the model was trained with; empty for models that need none. */
  prefix: { query: string; passage: string };
}

/** Local embedding models that cover German. E5 needs "query: " / "passage: " prefixes. */
const E5_SMALL: LocalModelSpec = {
  name: 'multilingual-e5-small',
  repo: 'Xenova/multilingual-e5-small',
  dimension: 384,
  pooling: 'mean',
  prefix: { query: 'query: ', passage: 'passage: ' },
};

export const LOCAL_MODELS: Record<string, LocalModelSpec> = {
  'local-e5': E5_SMALL,
  'local-e5-base': {
    name: 'multilingual-e5-base',
    repo: 'Xenova/multilingual-e5-base',
    dimension: 768,
    pooling: 'mean',
    prefix: { query: 'query: ', passage: 'passage: ' },
  },
  'local-e5-large': {
    name: 'multilingual-e5-large',
    repo: 'Xenova/multilingual-e5-large',
    dimension: 1024,
    pooling: 'mean',
    prefix: { query: 'query: ', passage: 'passage: ' },
  },
  'local-bge-m3': {
    name: 'bge-m3',
    repo: 'Xenova/bge-m3',
    dimension: 1024,
    pooling: 'cls',
    prefix: { query: '', passage: '' },
  },
};

export interface LocalEmbedderOptions {
  /** Where the model files are cached; keep it outside git. */
  cacheDir?: string;
  batchSize?: number;
}

type Extractor = (texts: string[], opts: object) => Promise<{ data: Float32Array }>;

/**
 * A multilingual embedding model running locally through transformers.js (8-bit quantized weights); no
 * data leaves the machine after the one-time model download.
 */
export class LocalEmbedder implements Embedder {
  readonly model: string;
  readonly dimension: number;
  private extractor: Promise<Extractor> | undefined;

  constructor(
    private readonly spec: LocalModelSpec,
    private readonly options: LocalEmbedderOptions = {},
  ) {
    this.model = spec.name;
    this.dimension = spec.dimension;
  }

  private cacheDir(): string {
    return this.options.cacheDir ?? join(process.cwd(), '.cache', 'models');
  }

  private load(): Promise<Extractor> {
    this.extractor ??= (async () => {
      const { pipeline, env } = await import('@huggingface/transformers');
      env.cacheDir = this.cacheDir();
      const p = await pipeline('feature-extraction', this.spec.repo, { dtype: 'q8' });
      return p as unknown as Extractor;
    })();
    return this.extractor;
  }

  /** Size in bytes of the downloaded weights (the quantized file); null before the model has been loaded. */
  async weightsBytes(): Promise<number | null> {
    await this.load();
    const file = join(
      this.cacheDir(),
      ...this.spec.repo.split('/'),
      'onnx',
      'model_quantized.onnx',
    );
    try {
      return (await stat(file)).size;
    } catch {
      return null;
    }
  }

  async embed(texts: string[], kind: 'query' | 'passage'): Promise<number[][]> {
    const extractor = await this.load();
    const batchSize = this.options.batchSize ?? 16;
    const prefix = this.spec.prefix[kind];
    const out: number[][] = [];
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize).map((t) => `${prefix}${t}`);
      const res = await extractor(batch, { pooling: this.spec.pooling, normalize: true });
      for (let j = 0; j < batch.length; j++) {
        out.push(Array.from(res.data.slice(j * this.dimension, (j + 1) * this.dimension)));
      }
    }
    return out;
  }
}

/** The multilingual E5 (small) model; kept as a named class for existing callers. */
export class LocalE5Embedder extends LocalEmbedder {
  constructor(options: LocalEmbedderOptions = {}) {
    super(E5_SMALL, options);
  }
}

export const EMBEDDER_NAMES = ['fake', ...Object.keys(LOCAL_MODELS)] as const;
export type EmbedderName = (typeof EMBEDDER_NAMES)[number];

export function createEmbedder(name: string | undefined): Embedder {
  if (name === 'fake') return new HashingEmbedder();
  const spec = LOCAL_MODELS[name ?? 'local-e5'];
  if (spec) return new LocalEmbedder(spec);
  throw new Error(`Unknown embedder "${name}" (expected one of: ${EMBEDDER_NAMES.join(', ')})`);
}
