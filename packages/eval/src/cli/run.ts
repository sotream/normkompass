import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { GesetzeImInternetSource, type CorpusUnit } from '@normkompass/corpus';
import {
  DEFAULT_CITATION_MATCH,
  DEFAULT_LEXICAL,
  DEFAULT_SEARCH_MODE,
  HybridSearch,
  LocalReranker,
  createEmbedder,
  createPool,
  readModelRecord,
  type SearchMode,
} from '@normkompass/search';
import { evaluateRetrieval } from '../evaluate.js';
import {
  EXTERNAL_SET_LIMITS,
  FULL_SET_LIMITS,
  LEXICAL_SET_LIMITS,
  loadQuestions,
  selectSplit,
  type Split,
  validateAgainstCorpus,
  validateLexical,
  validateStructure,
} from '../questions.js';

if (existsSync('.env')) process.loadEnvFile('.env');
const validateOnly = process.argv.includes('--validate-only');
const argValue = (name: string): string | undefined => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const mode = (argValue('--mode') ?? DEFAULT_SEARCH_MODE) as SearchMode;
if (!['hybrid', 'vector', 'fts'].includes(mode)) {
  console.error('--mode must be hybrid, vector or fts');
  process.exit(1);
}
const rerank = process.argv.includes('--rerank');
const compoundSplitting = !process.argv.includes('--no-compound');
const split = (argValue('--split') ?? 'all') as Split;
if (!['all', 'dev', 'heldout'].includes(split)) {
  console.error('--split must be all, dev or heldout');
  process.exit(1);
}
const numberFlag = (name: string): number | undefined => {
  const v = argValue(name);
  if (v === undefined) return undefined;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) {
    console.error(`${name} must be a non-negative number`);
    process.exit(1);
  }
  return n;
};
const ftsWeight = numberFlag('--fts-weight');
const ftsMaxDocShare = numberFlag('--fts-max-share');
const lexicalRanking = (argValue('--lexical') ?? DEFAULT_LEXICAL) as 'fts' | 'bm25';
if (!['fts', 'bm25'].includes(lexicalRanking)) {
  console.error('--lexical must be fts or bm25');
  process.exit(1);
}
const ftsQuery = (argValue('--fts-query') ?? 'or') as 'or' | 'and';
if (!['or', 'and'].includes(ftsQuery)) {
  console.error('--fts-query must be or or and');
  process.exit(1);
}
const citationMatch = process.argv.includes('--no-citation') ? false : DEFAULT_CITATION_MATCH;
const citationWeight = numberFlag('--citation-weight');
const bm25B = numberFlag('--bm25-b');
const keepSeparatedNumbers = process.argv.includes('--keep-numbers');

const questionFile = argValue('--questions') ?? join('eval', 'questions.jsonl');
const external = questionFile.includes('external');
const lexical = !external && questionFile.includes('lexical');
const setKind = external ? 'external' : lexical ? 'lexical' : 'paraphrase';
const questions = await loadQuestions(questionFile);
const source = new GesetzeImInternetSource({
  cacheDir: join(process.cwd(), '.cache', 'gesetze-im-internet'),
});
const units: CorpusUnit[] = [];
for await (const doc of source.loadDocuments()) units.push(...source.split(doc).units);

const problems = [
  ...validateStructure(
    questions,
    external ? EXTERNAL_SET_LIMITS : lexical ? LEXICAL_SET_LIMITS : FULL_SET_LIMITS,
  ),
  ...(lexical ? validateLexical(questions, units) : []),
  // External questions that are ambiguous are kept and flagged by the conversion, so only quoting is checked.
  ...(external ? validateLexical(questions, units, { ambiguity: false }) : []),
  ...validateAgainstCorpus(questions, units),
];
if (problems.length > 0) {
  console.error(`Eval set is invalid:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
  process.exit(1);
}
const answerable = questions.filter((q) => q.answerable).length;
console.log(
  `Eval set valid: ${answerable} answerable, ${questions.length - answerable} unanswerable, ` +
    `${questions.filter((q) => q.needs_review).length} flagged needs_review.`,
);
if (validateOnly) process.exit(0);

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is not set (see .env.example).');
  process.exit(1);
}
const embedder = createEmbedder(argValue('--embedder') ?? process.env.EMBEDDER);
const pool = createPool({ connectionString });
try {
  const reranker = rerank ? new LocalReranker() : undefined;
  const { metrics, results } = await evaluateRetrieval(
    new HybridSearch(pool, embedder, reranker),
    selectSplit(questions, split),
    10,
    {
      mode,
      rerank,
      compoundSplitting,
      ftsWeight,
      ftsMaxDocShare,
      lexical: lexicalRanking,
      ftsQuery,
      citationMatch,
      citationWeight,
      bm25B,
      keepSeparatedNumbers,
    },
  );
  const cost = await readModelRecord(pool, embedder.model);
  const git = (...args: string[]): string =>
    execFileSync('git', args, { encoding: 'utf-8' }).trim();
  const commit = git('rev-parse', '--short', 'HEAD');
  const dirty = git('status', '--porcelain', '--', ':!eval/results').length > 0;
  const date = new Date().toISOString().slice(0, 10);

  console.log(
    `\nModel: ${embedder.model}   mode: ${mode}${rerank ? ' + rerank' : ''}${compoundSplitting ? '' : ' (no compound splitting)'}${ftsWeight === undefined ? '' : ` fts-weight ${ftsWeight}`}${ftsMaxDocShare === undefined ? '' : ` fts-max-share ${ftsMaxDocShare}`} lexical ${lexicalRanking}${ftsQuery === 'or' ? '' : ` fts-query ${ftsQuery}`}${citationMatch ? ' citation' : ' no-citation'}   split: ${split}   commit: ${commit}${dirty ? ' (dirty)' : ''}   date: ${date}`,
  );
  console.log(`Questions: ${metrics.questions}`);
  console.log(`recall@5: ${metrics.recallAt5.toFixed(3)}`);
  console.log(`MRR:      ${metrics.mrr.toFixed(3)}`);
  const misses = results.filter((r) => r.firstHitRank === null || r.firstHitRank > 5);
  console.log(`\nNot in top 5 (${misses.length}):`);
  for (const r of misses) {
    console.log(
      `  ${r.id} rank ${r.firstHitRank ?? '>10'}  ${r.question}\n      expected ${r.expected.join(', ')}`,
    );
  }

  await mkdir(join('eval', 'results'), { recursive: true });
  const variant = [
    mode === DEFAULT_SEARCH_MODE ? '' : `-${mode}`,
    rerank ? '-rerank' : '',
    compoundSplitting ? '' : '-nocompound',
    ftsWeight === undefined ? '' : `-w${ftsWeight}`,
    ftsMaxDocShare === undefined ? '' : `-share${ftsMaxDocShare}`,
    lexicalRanking === DEFAULT_LEXICAL ? '' : `-${lexicalRanking}`,
    ftsQuery === 'or' ? '' : `-q${ftsQuery}`,
    citationMatch === DEFAULT_CITATION_MATCH ? '' : '-nocitation',
    bm25B === undefined ? '' : `-b${bm25B}`,
    keepSeparatedNumbers ? '-keepnum' : '',
    split === 'all' ? '' : `-${split}`,
    setKind === 'paraphrase' ? '' : `-${setKind}`,
  ].join('');
  const file = join('eval', 'results', `${date}-${embedder.model}${variant}.json`);
  await writeFile(
    file,
    `${JSON.stringify(
      {
        date,
        commit,
        dirty,
        embedder: embedder.model,
        mode,
        rerank: rerank ? reranker?.model : null,
        compoundSplitting,
        split,
        questionSet: setKind,
        ftsWeight: ftsWeight ?? null,
        ftsMaxDocShare: ftsMaxDocShare ?? null,
        lexical: lexicalRanking,
        ftsQuery,
        citationMatch,
        citationWeight: citationWeight ?? null,
        bm25B: bm25B ?? null,
        keepSeparatedNumbers,
        indexingSeconds: cost?.indexingSeconds ?? null,
        weightsBytes: cost?.weightsBytes ?? null,
        dimension: embedder.dimension,
        questions: metrics.questions,
        recallAt5: metrics.recallAt5,
        mrr: metrics.mrr,
        perQuestion: results.map((r) => ({
          id: r.id,
          firstHitRank: r.firstHitRank,
          recallAt5: r.recallAt5,
        })),
      },
      null,
      2,
    )}\n`,
  );
  console.log(`\nWrote ${file}`);
} finally {
  await pool.end();
}
