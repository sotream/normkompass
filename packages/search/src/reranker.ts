import { join } from 'node:path';

/** Scores how well each passage answers a question; higher is better. Used only to reorder candidates. */
export interface Reranker {
  readonly model: string;
  score(question: string, passages: string[]): Promise<number[]>;
}

/** Deterministic stand-in for tests: the share of question words that occur in the passage. */
export class OverlapReranker implements Reranker {
  readonly model = 'fake-overlap';

  score(question: string, passages: string[]): Promise<number[]> {
    const words = new Set(question.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []);
    return Promise.resolve(
      passages.map((p) => {
        const have = new Set(p.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []);
        let hits = 0;
        for (const w of words) if (have.has(w)) hits++;
        return words.size === 0 ? 0 : hits / words.size;
      }),
    );
  }
}

export interface LocalRerankerOptions {
  cacheDir?: string;
  /** Pairs scored per forward pass. */
  batchSize?: number;
}

type Tokenizer = (a: string[], opts: object) => unknown;
type SequenceModel = (inputs: unknown) => Promise<{ logits: { data: Float32Array } }>;

/**
 * A multilingual cross-encoder (bge-reranker-v2-m3) running locally through transformers.js with 8-bit
 * weights. It reads the question and a passage together, which is slower than comparing embeddings.
 */
export class LocalReranker implements Reranker {
  readonly model = 'bge-reranker-v2-m3';
  private loaded: Promise<{ tokenizer: Tokenizer; model: SequenceModel }> | undefined;

  constructor(private readonly options: LocalRerankerOptions = {}) {}

  private load() {
    this.loaded ??= (async () => {
      const { AutoTokenizer, AutoModelForSequenceClassification, env } =
        await import('@huggingface/transformers');
      env.cacheDir = this.options.cacheDir ?? join(process.cwd(), '.cache', 'models');
      const repo = 'onnx-community/bge-reranker-v2-m3-ONNX';
      const tokenizer = (await AutoTokenizer.from_pretrained(repo)) as unknown as Tokenizer;
      const model = (await AutoModelForSequenceClassification.from_pretrained(repo, {
        dtype: 'q8',
      })) as unknown as SequenceModel;
      return { tokenizer, model };
    })();
    return this.loaded;
  }

  async score(question: string, passages: string[]): Promise<number[]> {
    const { tokenizer, model } = await this.load();
    const batchSize = this.options.batchSize ?? 4;
    const out: number[] = [];
    for (let i = 0; i < passages.length; i += batchSize) {
      const batch = passages.slice(i, i + batchSize);
      const inputs = tokenizer(new Array<string>(batch.length).fill(question), {
        text_pair: batch,
        padding: true,
        truncation: true,
        max_length: 512,
      });
      const { logits } = await model(inputs);
      out.push(...Array.from(logits.data).slice(0, batch.length));
    }
    return out;
  }
}
