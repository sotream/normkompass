import { Vocabulary, expandQueryTerms } from './compound.js';
import { ensureEmbeddingTable, toVectorLiteral, type Pool } from './db.js';
import type { Embedder } from './embedder.js';
import type { Reranker } from './reranker.js';

export interface SearchHit {
  chunkId: string;
  unitId: string;
  part: number;
  source: string;
  path: string[];
  label: string;
  title: string;
  url: string;
  stand: string | null;
  text: string;
  score: number;
  vectorRank: number | null;
  ftsRank: number | null;
}

/** Which rankings are used: both merged (default), only vector similarity, or only full-text. */
export type SearchMode = 'hybrid' | 'vector' | 'fts';

export interface SearchOptions {
  limit?: number;
  /** Candidates taken from each of the two searches before merging. */
  candidates?: number;
  mode?: SearchMode;
  /** Split German compounds in the full-text query (default true); switch off to measure its effect. */
  compoundSplitting?: boolean;
  /** Reorder the best candidates with the reranker given to the constructor; off by default. */
  rerank?: boolean;
  /** How many fused candidates the reranker sees. */
  rerankDepth?: number;
}

export const DEFAULT_RERANK_DEPTH = 20;

/** Reciprocal Rank Fusion constant. */
export const RRF_K = 60;

export function rrfMerge(
  lists: { id: string; rank: number }[][],
  k: number = RRF_K,
): Map<string, number> {
  const scores = new Map<string, number>();
  for (const list of lists) {
    for (const { id, rank } of list) scores.set(id, (scores.get(id) ?? 0) + 1 / (k + rank));
  }
  return scores;
}

interface Row {
  id: string;
  unit_id: string;
  part: number;
  source: string;
  path: string[];
  label: string;
  title: string;
  url: string;
  stand: string | null;
  text: string;
}

const COLUMNS =
  'c.id, c.unit_id, c.part, c.source, c.path, c.label, c.title, c.url, c.stand, c.text';

/** Hybrid search: vector similarity and German full-text, merged with RRF. */
export class HybridSearch {
  private vocabulary: Promise<Vocabulary> | undefined;

  constructor(
    private readonly pool: Pool,
    private readonly embedder: Embedder,
    private readonly reranker?: Reranker,
  ) {}

  private loadVocabulary(): Promise<Vocabulary> {
    this.vocabulary ??= this.pool
      .query<{ text: string }>('SELECT text FROM chunks')
      .then((r) => Vocabulary.fromTexts(r.rows.map((x) => x.text)));
    return this.vocabulary;
  }

  /** Terms used for full-text search: question words plus parts of known compounds. */
  async queryTerms(question: string, compoundSplitting = true): Promise<string[]> {
    if (!compoundSplitting) return expandQueryTerms(question, Vocabulary.fromTexts([]));
    return expandQueryTerms(question, await this.loadVocabulary());
  }

  async search(question: string, options: SearchOptions = {}): Promise<SearchHit[]> {
    const limit = options.limit ?? 5;
    const candidates = options.candidates ?? 50;
    const mode = options.mode ?? 'hybrid';
    if (options.rerank && !this.reranker)
      throw new Error('rerank requested but no reranker is configured');
    const empty = { rows: [] as Row[] };

    const vector = mode === 'fts' ? empty : await this.vectorSearch(question, candidates);
    const terms =
      mode === 'vector' ? [] : await this.queryTerms(question, options.compoundSplitting);
    const fts =
      terms.length === 0
        ? empty
        : await this.pool.query<Row>(
            `WITH q AS (SELECT to_tsquery('german', $1) AS query)
             SELECT ${COLUMNS} FROM chunks c, q
             WHERE c.fts @@ q.query ORDER BY ts_rank_cd(c.fts, q.query) DESC, c.id LIMIT $2`,
            [terms.join(' | '), candidates],
          );

    const rows = new Map<string, Row>();
    const vectorRank = new Map<string, number>();
    const ftsRank = new Map<string, number>();
    vector.rows.forEach((r, i) => {
      rows.set(r.id, r);
      vectorRank.set(r.id, i + 1);
    });
    fts.rows.forEach((r, i) => {
      rows.set(r.id, r);
      ftsRank.set(r.id, i + 1);
    });
    const scores = rrfMerge([
      [...vectorRank].map(([id, rank]) => ({ id, rank })),
      [...ftsRank].map(([id, rank]) => ({ id, rank })),
    ]);

    const fused = [...scores]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .flatMap(([id, score]) => {
        const r = rows.get(id);
        if (!r) return [];
        return [
          {
            chunkId: r.id,
            unitId: r.unit_id,
            part: r.part,
            source: r.source,
            path: r.path,
            label: r.label,
            title: r.title,
            url: r.url,
            stand: r.stand,
            text: r.text,
            score,
            vectorRank: vectorRank.get(id) ?? null,
            ftsRank: ftsRank.get(id) ?? null,
          },
        ];
      });
    if (!options.rerank || !this.reranker) return fused.slice(0, limit);

    const pool = fused.slice(0, Math.max(options.rerankDepth ?? DEFAULT_RERANK_DEPTH, limit));
    const scores2 = await this.reranker.score(
      question,
      pool.map((h) => `${h.label} ${h.title}\n${h.text}`),
    );
    return pool
      .map((hit, i) => ({ hit, score: scores2[i] ?? Number.NEGATIVE_INFINITY }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ hit, score }) => ({ ...hit, score }));
  }

  private async vectorSearch(question: string, candidates: number): Promise<{ rows: Row[] }> {
    const table = await ensureEmbeddingTable(this.pool, this.embedder.dimension);
    const queryVector = (await this.embedder.embed([question], 'query'))[0];
    if (!queryVector) throw new Error('Embedder returned no vector for the question');
    return this.pool.query<Row>(
      `SELECT ${COLUMNS} FROM ${table} e JOIN chunks c ON c.id = e.chunk_id
       WHERE e.model = $1 ORDER BY e.embedding <=> $2::vector LIMIT $3`,
      [this.embedder.model, toVectorLiteral(queryVector), candidates],
    );
  }
}
