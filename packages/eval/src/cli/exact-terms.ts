import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { GesetzeImInternetSource, type CorpusUnit } from '@normkompass/corpus';
import { HybridSearch, createEmbedder, createPool, type SearchOptions } from '@normkompass/search';
import { pairedBootstrap } from '../compare.js';
import {
  componentRank,
  fusedRank,
  outranking,
  reciprocal,
  separatedNumbers,
  spearman,
  type RankedHit,
} from '../exact-terms.js';
import { loadQuestions } from '../questions.js';

if (existsSync('.env')) process.loadEnvFile('.env');
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is not set (see .env.example).');
  process.exit(1);
}

const questions = (await loadQuestions(join('eval', 'lexical-questions.jsonl'))).filter(
  (q) => q.answerable && (q.style === 'term' || q.style === 'number'),
);
const source = new GesetzeImInternetSource({
  cacheDir: join(process.cwd(), '.cache', 'gesetze-im-internet'),
});
const units: CorpusUnit[] = [];
for await (const doc of source.loadDocuments()) units.push(...source.split(doc).units);
const byId = new Map(units.map((u) => [u.id, u]));
const length = (id: string): number => byId.get(id)?.text.length ?? 0;

interface Row {
  id: string;
  style: string | undefined;
  question: string;
  terms: string[];
  expected: string[];
  defaultRank: number | null;
  olderRank: number | null;
  vectorRank: number | null;
  bm25Rank: number | null;
  fullTextRank: number | null;
  bm25RankQuotedOnly: number | null;
  fullTextRankQuotedOnly: number | null;
  termLexemes: string[];
  lexemesLostInQuery: string[];
  lexemesMissingInExpected: string[];
  expectedLength: number;
  bm25Outranking: { id: string; length: number }[];
}

// The analysis describes the search before ADR 0005 changed separated numbers, so that option is pinned off.
const DEFAULT: SearchOptions = {
  mode: 'hybrid',
  lexical: 'bm25',
  citationMatch: true,
  keepSeparatedNumbers: false,
  limit: 50,
};
const OLDER: SearchOptions = {
  mode: 'hybrid',
  lexical: 'fts',
  citationMatch: false,
  keepSeparatedNumbers: false,
  limit: 50,
};

const pool = createPool({ connectionString });
try {
  const search = new HybridSearch(pool, createEmbedder(process.env.EMBEDDER));
  const lexemes = async (text: string): Promise<string[]> =>
    (
      await pool.query<{ lexeme: string }>(
        `SELECT lexeme FROM unnest(to_tsvector('german', $1)) AS u(lexeme, positions, weights)`,
        [text],
      )
    ).rows.map((r) => r.lexeme);
  const unitLexemes = async (ids: string[]): Promise<Set<string>> =>
    new Set(
      (
        await pool.query<{ lexeme: string }>(
          `SELECT DISTINCT u.lexeme
           FROM chunks c,
                LATERAL unnest(to_tsvector('german', coalesce(c.title, '') || ' ' || c.text)) AS u(lexeme, positions, weights)
           WHERE c.unit_id = ANY($1)`,
          [ids],
        )
      ).rows.map((r) => r.lexeme),
    );
  const ranked = (hits: Awaited<ReturnType<typeof search.search>>): RankedHit[] => hits;

  const rows: Row[] = [];
  for (const q of questions) {
    const terms = q.terms ?? [];
    const quoted = terms.join(' ');
    const d = ranked(await search.search(q.question, DEFAULT));
    const o = ranked(await search.search(q.question, OLDER));
    // The same ranking components fed only the quoted words, to separate "the word cannot be found" from
    // "the word is found but diluted by the other words of the question".
    const dQuoted = ranked(await search.search(quoted, { ...DEFAULT, citationMatch: false }));
    const oQuoted = ranked(await search.search(quoted, OLDER));

    const termLexemes = await lexemes(quoted);
    const queryLexemes = new Set(
      await lexemes((await search.queryTerms(quoted, true, false)).join(' ')),
    );
    const inUnit = await unitLexemes(q.expected);
    const topLexical = outranking(d, q.expected, 'ftsRank');
    rows.push({
      id: q.id,
      style: q.style,
      question: q.question,
      terms,
      expected: q.expected,
      defaultRank: fusedRank(d, q.expected),
      olderRank: fusedRank(o, q.expected),
      vectorRank: componentRank(d, q.expected, 'vectorRank'),
      bm25Rank: componentRank(d, q.expected, 'ftsRank'),
      fullTextRank: componentRank(o, q.expected, 'ftsRank'),
      bm25RankQuotedOnly: componentRank(dQuoted, q.expected, 'ftsRank'),
      fullTextRankQuotedOnly: componentRank(oQuoted, q.expected, 'ftsRank'),
      termLexemes,
      lexemesLostInQuery: termLexemes.filter((l) => !queryLexemes.has(l)),
      lexemesMissingInExpected: termLexemes.filter((l) => !inUnit.has(l)),
      expectedLength: Math.max(...q.expected.map(length)),
      bm25Outranking: topLexical.map((id) => ({ id, length: length(id) })),
    });
  }

  const subset = (style?: string): Row[] =>
    rows.filter((r) => style === undefined || r.style === style);
  const summarize = (style?: string): Record<string, unknown> => {
    const s = subset(style);
    const a = {
      mrr: s.map((r) => reciprocal(r.defaultRank)),
      recall: s.map((r) => ((r.defaultRank ?? 99) <= 5 ? 1 : 0)),
    };
    const b = {
      mrr: s.map((r) => reciprocal(r.olderRank)),
      recall: s.map((r) => ((r.olderRank ?? 99) <= 5 ? 1 : 0)),
    };
    return {
      questions: s.length,
      olderBetter: s.filter((r) => reciprocal(r.olderRank) > reciprocal(r.defaultRank)).length,
      defaultBetter: s.filter((r) => reciprocal(r.defaultRank) > reciprocal(r.olderRank)).length,
      equal: s.filter((r) => reciprocal(r.defaultRank) === reciprocal(r.olderRank)).length,
      mrrOlderMinusDefault: pairedBootstrap(a.mrr, b.mrr),
      recallOlderMinusDefault: pairedBootstrap(a.recall, b.recall),
      withLexemesLostInQuery: s.filter((r) => r.lexemesLostInQuery.length > 0).length,
      withLexemesMissingInExpected: s.filter((r) => r.lexemesMissingInExpected.length > 0).length,
    };
  };
  const summary = { all: summarize(), term: summarize('term'), number: summarize('number') };

  // Does a longer expected unit go with a worse BM25 rank than full-text rank? (Ranks beyond 50 count as 51.)
  const cap = (r: number | null): number => r ?? 51;
  const lengthEffect = {
    questions: rows.length,
    spearmanLengthVsBm25MinusFullText: spearman(
      rows.map((r) => r.expectedLength),
      rows.map((r) => cap(r.bm25Rank) - cap(r.fullTextRank)),
    ),
    longestFive: [...rows]
      .sort((a, b) => b.expectedLength - a.expectedLength)
      .slice(0, 5)
      .map((r) => ({
        id: r.id,
        length: r.expectedLength,
        bm25Rank: r.bm25Rank,
        fullTextRank: r.fullTextRank,
      })),
  };

  // Numbers written with a separator ("6.000") are one token in the document index but are split in the query.
  const tokens = new Set<string>();
  const tokenUnits = new Map<string, number>();
  for (const u of units) {
    for (const t of separatedNumbers(u.text)) {
      tokens.add(t);
      tokenUnits.set(t, (tokenUnits.get(t) ?? 0) + 1);
    }
  }
  const lost: string[] = [];
  for (const t of tokens) {
    const doc = await lexemes(t);
    const query = new Set(await lexemes((await search.queryTerms(t, true, false)).join(' ')));
    if (doc.some((l) => !query.has(l))) lost.push(t);
  }
  const separatorProbe = {
    distinctTokens: tokens.size,
    unitsWithAToken: units.filter((u) => separatedNumbers(u.text).length > 0).length,
    totalUnits: units.length,
    tokensLostInTheQuery: lost.length,
    examples: lost.slice(0, 10),
    inTheExactTermQuestions: rows.filter((r) => r.terms.some((t) => separatedNumbers(t).length > 0))
      .length,
  };

  const git = (...args: string[]): string =>
    execFileSync('git', args, { encoding: 'utf-8' }).trim();
  const date = new Date().toISOString().slice(0, 10);
  await mkdir(join('eval', 'results'), { recursive: true });
  const file = join('eval', 'results', `exact-terms-${date}.json`);
  await writeFile(
    file,
    `${JSON.stringify({ date, commit: git('rev-parse', '--short', 'HEAD'), embedder: process.env.EMBEDDER ?? null, summary, lengthEffect, separatorProbe, rows }, null, 2)}\n`,
  );
  console.log(JSON.stringify({ lengthEffect, separatorProbe }, null, 2));
  console.log(`\nWrote ${file}`);
} finally {
  await pool.end();
}
