import { Vocabulary, expandQueryTerms } from './compound.js';
import { ensureEmbeddingTable, toVectorLiteral, type Pool } from './db.js';
import type { Embedder } from './embedder.js';
import { Bm25, type Bm25Doc } from './bm25.js';
import { labelMatches, parseCitations } from './citation.js';
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
  /** Rank in the lexical list (full-text or BM25, whichever was used). */
  ftsRank: number | null;
  /** Rank among chunks whose citation label the question names; only with `citationMatch`. */
  citationRank?: number | null;
}

/** Which rankings are used: both merged (default), only vector similarity, or only full-text. */
export type SearchMode = 'hybrid' | 'vector' | 'fts';

/**
 * The default configuration is hybrid search with a BM25 lexical ranking and citation matching. It was chosen
 * by a rule fixed before the runs (ADR 0004): not worse than vector-only on held-out paraphrase questions and
 * better on held-out lexical questions. Vector-only, plain full-text and the other options stay selectable.
 */
export const DEFAULT_SEARCH_MODE: SearchMode = 'hybrid';
export const DEFAULT_LEXICAL = 'bm25';
export const DEFAULT_CITATION_MATCH = true;

export interface SearchOptions {
  limit?: number;
  /** Candidates taken from each of the two searches before merging. */
  candidates?: number;
  mode?: SearchMode;
  /** Split German compounds in the full-text query (default true); switch off to measure its effect. */
  compoundSplitting?: boolean;
  /** Weight of the full-text ranking in the fusion relative to the vector ranking (default 1). */
  ftsWeight?: number;
  /**
   * Drop query terms that occur in more than this share of all chunks (0 to 1) from the full-text query;
   * off by default. If every term would be dropped, the full query is kept.
   */
  ftsMaxDocShare?: number;
  /**
   * BM25 length normalization (0 to 1, default 0.75); lower values discount long units less. Only for BM25.
   * An option for the analysis of ADR 0005.
   */
  bm25B?: number;
  /**
   * Keep numbers written with a separator ("6.000", "30,5") as one query term, as they are one word in the
   * index; by default they are split into digit groups that cannot match (ADR 0005). Off by default.
   */
  keepSeparatedNumbers?: boolean;
  /** Which lexical ranking feeds the "fts" side: BM25 computed in the application (default) or Postgres full-text. */
  lexical?: 'fts' | 'bm25';
  /**
   * With "and", the full-text query first requires every question word and falls back to the OR query when
   * that finds nothing (default "or"). Only for the Postgres full-text ranking.
   */
  ftsQuery?: 'or' | 'and';
  /** Adds the chunks whose citation label the question names (for example "§ 14 Abs. 1 UStG") as a third ranking (default true). */
  citationMatch?: boolean;
  /** Weight of that ranking in the fusion (default 1). */
  citationWeight?: number;
  /** Reorder the best candidates with the reranker given to the constructor; off by default. */
  rerank?: boolean;
  /** How many fused candidates the reranker sees. */
  rerankDepth?: number;
}

export const DEFAULT_RERANK_DEPTH = 20;

/** Reciprocal Rank Fusion constant. */
export const RRF_K = 60;

/** Weight of the full-text ranking relative to the vector ranking in the fusion. */
export const DEFAULT_FTS_WEIGHT = 1;

/** Weighted Reciprocal Rank Fusion; `weights[i]` scales list `i` (default 1 for every list). */
export function rrfMerge(
  lists: { id: string; rank: number }[][],
  k: number = RRF_K,
  weights: number[] = [],
): Map<string, number> {
  const scores = new Map<string, number>();
  lists.forEach((list, i) => {
    const weight = weights[i] ?? 1;
    for (const { id, rank } of list) scores.set(id, (scores.get(id) ?? 0) + weight / (k + rank));
  });
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
  async queryTerms(
    question: string,
    compoundSplitting = true,
    keepSeparatedNumbers = false,
  ): Promise<string[]> {
    const options = { keepSeparatedNumbers };
    if (!compoundSplitting) return expandQueryTerms(question, Vocabulary.fromTexts([]), options);
    return expandQueryTerms(question, await this.loadVocabulary(), options);
  }

  async search(question: string, options: SearchOptions = {}): Promise<SearchHit[]> {
    const limit = options.limit ?? 5;
    const candidates = options.candidates ?? 50;
    const mode = options.mode ?? DEFAULT_SEARCH_MODE;
    if (options.rerank && !this.reranker)
      throw new Error('rerank requested but no reranker is configured');
    const empty = { rows: [] as Row[] };

    const vector = mode === 'fts' ? empty : await this.vectorSearch(question, candidates);
    const allTerms =
      mode === 'vector'
        ? []
        : await this.queryTerms(question, options.compoundSplitting, options.keepSeparatedNumbers);
    const terms = await this.dropCommonTerms(allTerms, options.ftsMaxDocShare);
    const fts =
      terms.length === 0
        ? empty
        : (options.lexical ?? DEFAULT_LEXICAL) === 'bm25'
          ? await this.bm25Search(terms, candidates, options.bm25B)
          : await this.ftsSearch(terms, candidates, options.ftsQuery ?? 'or', question);
    const citationMatch = options.citationMatch ?? DEFAULT_CITATION_MATCH;
    const citations = citationMatch ? await this.citationSearch(question) : empty;

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
    const citationRank = new Map<string, number>();
    citations.rows.forEach((r, i) => {
      rows.set(r.id, r);
      citationRank.set(r.id, i + 1);
    });
    const scores = rrfMerge(
      [
        [...vectorRank].map(([id, rank]) => ({ id, rank })),
        [...ftsRank].map(([id, rank]) => ({ id, rank })),
        [...citationRank].map(([id, rank]) => ({ id, rank })),
      ],
      RRF_K,
      [1, options.ftsWeight ?? DEFAULT_FTS_WEIGHT, options.citationWeight ?? 1],
    );

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
            ...(citationMatch ? { citationRank: citationRank.get(id) ?? null } : {}),
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

  private async ftsSearch(
    terms: string[],
    candidates: number,
    query: 'or' | 'and',
    question: string,
  ): Promise<{ rows: Row[] }> {
    const sql = `SELECT ${COLUMNS} FROM chunks c, q
             WHERE c.fts @@ q.query ORDER BY ts_rank_cd(c.fts, q.query) DESC, c.id LIMIT $2`;
    if (query === 'and') {
      const strict = await this.pool.query<Row>(
        `WITH q AS (SELECT plainto_tsquery('german', $1) AS query) ${sql}`,
        [question, candidates],
      );
      if (strict.rows.length > 0) return strict;
    }
    return this.pool.query<Row>(`WITH q AS (SELECT to_tsquery('german', $1) AS query) ${sql}`, [
      terms.join(' | '),
      candidates,
    ]);
  }

  private bm25Docs: Promise<Bm25Doc[]> | undefined;
  private readonly bm25Indexes = new Map<number | undefined, Bm25>();

  /** The German-normalized terms of every chunk (title and text), read once per instance. */
  private loadBm25Docs(): Promise<Bm25Doc[]> {
    this.bm25Docs ??= this.pool
      .query<{ id: string; lexeme: string; tf: number }>(
        `SELECT c.id, u.lexeme, coalesce(array_length(u.positions, 1), 1) AS tf
         FROM chunks c,
              LATERAL unnest(to_tsvector('german', coalesce(c.title, '') || ' ' || c.text)) AS u(lexeme, positions, weights)`,
      )
      .then((res) => {
        const docs = new Map<string, Map<string, number>>();
        for (const r of res.rows) {
          const terms = docs.get(r.id) ?? new Map<string, number>();
          terms.set(r.lexeme, r.tf);
          docs.set(r.id, terms);
        }
        return [...docs].map(([id, terms]) => ({ id, terms }));
      });
    return this.bm25Docs;
  }

  /** The BM25 index for one length normalization, built from the shared documents on first use. */
  private async loadBm25(b: number | undefined): Promise<Bm25> {
    const known = this.bm25Indexes.get(b);
    if (known) return known;
    const index = new Bm25(await this.loadBm25Docs(), b === undefined ? {} : { b });
    this.bm25Indexes.set(b, index);
    return index;
  }

  private async bm25Search(
    terms: string[],
    candidates: number,
    b: number | undefined,
  ): Promise<{ rows: Row[] }> {
    const lexemes = await this.pool.query<{ lexeme: string }>(
      `SELECT lexeme FROM unnest(to_tsvector('german', $1)) AS u(lexeme, positions, weights)`,
      [terms.join(' ')],
    );
    const ranked = (await this.loadBm25(b)).search(
      lexemes.rows.map((r) => r.lexeme),
      candidates,
    );
    if (ranked.length === 0) return { rows: [] };
    const res = await this.pool.query<Row>(`SELECT ${COLUMNS} FROM chunks c WHERE c.id = ANY($1)`, [
      ranked.map((r) => r.id),
    ]);
    const byId = new Map(res.rows.map((r) => [r.id, r]));
    return {
      rows: ranked.flatMap((r) => {
        const row = byId.get(r.id);
        return row ? [row] : [];
      }),
    };
  }

  /** Chunks whose label is one of the citations the question names, whole sections first limited to 10. */
  private async citationSearch(question: string): Promise<{ rows: Row[] }> {
    const refs = parseCitations(question);
    if (refs.length === 0) return { rows: [] };
    const found = new Map<string, Row>();
    for (const ref of refs) {
      const res = await this.pool.query<Row>(
        `SELECT ${COLUMNS} FROM chunks c WHERE c.part = 1 AND c.label LIKE $1 ORDER BY c.id`,
        [`§ ${ref.section} %`],
      );
      for (const r of res.rows) if (labelMatches(r.label, ref)) found.set(r.id, r);
    }
    // The Absatz itself before its Nummer sub-units, so a named Absatz is the first result.
    const ordered = [...found.values()].sort(
      (a, b) => Number(a.label.includes(' Nr. ')) - Number(b.label.includes(' Nr. ')),
    );
    return { rows: ordered.slice(0, 10) };
  }

  /** Removes terms found in more than `maxShare` of the chunks; keeps all terms if none would remain. */
  private async dropCommonTerms(terms: string[], maxShare: number | undefined): Promise<string[]> {
    if (maxShare === undefined || terms.length === 0) return terms;
    const res = await this.pool.query<{ term: string; share: number }>(
      `SELECT t AS term,
              (SELECT count(*) FROM chunks c WHERE c.fts @@ plainto_tsquery('german', t))::float
                / GREATEST((SELECT count(*) FROM chunks), 1) AS share
       FROM unnest($1::text[]) AS t`,
      [terms],
    );
    const common = new Set(res.rows.filter((r) => r.share > maxShare).map((r) => r.term));
    const kept = terms.filter((t) => !common.has(t));
    return kept.length > 0 ? kept : terms;
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
