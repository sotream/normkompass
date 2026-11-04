import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { GesetzeImInternetSource, type CorpusUnit } from '@normkompass/corpus';
import { HybridSearch, createEmbedder, createPool } from '@normkompass/search';
import { RarityIndex, summarizeDiagnosis, type QuestionDiagnosis } from '../diagnose.js';
import { scoreQuestion } from '../metrics.js';
import { loadQuestions } from '../questions.js';

if (existsSync('.env')) process.loadEnvFile('.env');
const argValue = (name: string): string | undefined => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const questionFile = argValue('--questions') ?? join('eval', 'questions.jsonl');
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is not set (see .env.example).');
  process.exit(1);
}

const questions = (await loadQuestions(questionFile)).filter((q) => q.answerable);
const source = new GesetzeImInternetSource({
  cacheDir: join(process.cwd(), '.cache', 'gesetze-im-internet'),
});
const units: CorpusUnit[] = [];
for await (const doc of source.loadDocuments()) units.push(...source.split(doc).units);
const byId = new Map(units.map((u) => [u.id, u]));
const rarity = new RarityIndex(units);

const embedder = createEmbedder(argValue('--embedder') ?? process.env.EMBEDDER);
const pool = createPool({ connectionString });
try {
  const search = new HybridSearch(pool, embedder);
  const rows: QuestionDiagnosis[] = [];
  for (const q of questions) {
    const vector = scoreQuestion(
      q,
      (await search.search(q.question, { mode: 'vector', limit: 50 })).map((h) => h.unitId),
    );
    const fts = scoreQuestion(
      q,
      (await search.search(q.question, { mode: 'fts', limit: 50 })).map((h) => h.unitId),
    );
    const expectedUnit = q.expected.map((id) => byId.get(id)).find((u) => u !== undefined);
    const firstFts = fts.returned[0] ? byId.get(fts.returned[0]) : undefined;
    rows.push({
      id: q.id,
      question: q.question,
      expected: q.expected,
      vectorRank: vector.firstHitRank,
      ftsRank: fts.firstHitRank,
      ftsOutranking: fts.returned.slice(0, Math.min(3, (fts.firstHitRank ?? 4) - 1)),
      expectedOverlap: expectedUnit ? rarity.overlap(q.question, expectedUnit) : 0,
      ftsTopOverlap:
        firstFts && fts.firstHitRank !== 1 ? rarity.overlap(q.question, firstFts) : null,
    });
  }
  const summary = summarizeDiagnosis(rows);
  const git = (...args: string[]): string =>
    execFileSync('git', args, { encoding: 'utf-8' }).trim();
  const commit = git('rev-parse', '--short', 'HEAD');
  const dirty = git('status', '--porcelain', '--', ':!eval/results').length > 0;
  const date = new Date().toISOString().slice(0, 10);

  console.log(
    `Diagnosis of ${questions.length} answerable questions (${embedder.model}), top 5 hits:`,
  );
  console.log(
    `  solved by both ${summary.both}, by vector only ${summary.vectorOnly}, by full-text only ${summary.ftsOnly}, by neither ${summary.neither}`,
  );
  console.log(
    `  full-text failures with a wrong unit first: ${summary.ftsFailures}; a rarity-weighted overlap prefers the expected unit in ${summary.rarityPrefersExpected}, ties in ${summary.rarityTies}, prefers the wrong unit in ${summary.rarityPrefersWrong}`,
  );
  console.log('\nQuestions only full-text solves:');
  for (const r of rows.filter((x) => (x.ftsRank ?? 99) <= 5 && (x.vectorRank ?? 99) > 5)) {
    console.log(`  ${r.id} vector ${r.vectorRank ?? '>50'}  ${r.question}`);
  }

  await mkdir(join('eval', 'results'), { recursive: true });
  const name = questionFile.includes('lexical') ? 'lexical' : 'paraphrase';
  const file = join('eval', 'results', `diagnosis-${date}-${name}-${embedder.model}.json`);
  await writeFile(
    file,
    `${JSON.stringify({ date, commit, dirty, embedder: embedder.model, questionFile, summary, rows }, null, 2)}\n`,
  );
  console.log(`\nWrote ${file}`);
} finally {
  await pool.end();
}
