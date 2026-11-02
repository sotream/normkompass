import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { GesetzeImInternetSource, type CorpusUnit } from '@normkompass/corpus';
import { HybridSearch, createEmbedder, createPool } from '@normkompass/search';
import { evaluateRetrieval } from '../evaluate.js';
import {
  FULL_SET_LIMITS,
  loadQuestions,
  validateAgainstCorpus,
  validateStructure,
} from '../questions.js';

if (existsSync('.env')) process.loadEnvFile('.env');
const validateOnly = process.argv.includes('--validate-only');

const questions = await loadQuestions(join('eval', 'questions.jsonl'));
const source = new GesetzeImInternetSource({
  cacheDir: join(process.cwd(), '.cache', 'gesetze-im-internet'),
});
const units: CorpusUnit[] = [];
for await (const doc of source.loadDocuments()) units.push(...source.split(doc).units);

const problems = [
  ...validateStructure(questions, FULL_SET_LIMITS),
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
const embedder = createEmbedder(process.env.EMBEDDER);
const pool = createPool({ connectionString });
try {
  const { metrics, results } = await evaluateRetrieval(new HybridSearch(pool, embedder), questions);
  const git = (...args: string[]): string =>
    execFileSync('git', args, { encoding: 'utf-8' }).trim();
  const commit = git('rev-parse', '--short', 'HEAD');
  const dirty = git('status', '--porcelain', '--', ':!eval/results').length > 0;
  const date = new Date().toISOString().slice(0, 10);

  console.log(
    `\nModel: ${embedder.model}   commit: ${commit}${dirty ? ' (dirty)' : ''}   date: ${date}`,
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
  const file = join('eval', 'results', `${date}-${embedder.model}.json`);
  await writeFile(
    file,
    `${JSON.stringify(
      {
        date,
        commit,
        dirty,
        embedder: embedder.model,
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
