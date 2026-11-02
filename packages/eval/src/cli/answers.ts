import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  AnswerPipeline,
  ConfigurationError,
  createAnswerModel,
  describeAnswerModel,
} from '@normkompass/answer';
import { HybridSearch, createEmbedder, createPool } from '@normkompass/search';
import { evaluateAnswers } from '../evaluate-answers.js';
import { loadQuestions } from '../questions.js';

if (existsSync('.env')) process.loadEnvFile('.env');

const questions = await loadQuestions(join('eval', 'questions.jsonl'));

if (!process.argv.includes('--yes')) {
  console.error(
    `This sends ${questions.length} requests to the configured answer model (ANSWER_PROVIDER: claude ` +
      'costs money, ollama runs locally and takes a while).\nRun again with --yes to confirm.',
  );
  process.exit(1);
}

let model;
let label;
try {
  label = describeAnswerModel();
  model = createAnswerModel();
} catch (error) {
  if (error instanceof ConfigurationError) {
    console.error(error.message);
    process.exit(1);
  }
  throw error;
}
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is not set (see .env.example).');
  process.exit(1);
}

const embedder = createEmbedder(process.env.EMBEDDER);
const pool = createPool({ connectionString });
try {
  const pipeline = new AnswerPipeline(new HybridSearch(pool, embedder), model);
  const { metrics, cases } = await evaluateAnswers(pipeline, questions, (done, total) => {
    if (done % 10 === 0 || done === total) console.log(`  ${done}/${total}`);
  });
  const git = (...args: string[]): string =>
    execFileSync('git', args, { encoding: 'utf-8' }).trim();
  const commit = git('rev-parse', '--short', 'HEAD');
  const dirty = git('status', '--porcelain', '--', ':!eval/results').length > 0;
  const date = new Date().toISOString().slice(0, 10);
  const fmt = (n: number | null): string => (n === null ? 'n/a' : n.toFixed(3));

  console.log(
    `\nAnswer model: ${label.provider} / ${label.model}${label.host ? ` @ ${label.host}` : ''}   embedder: ${embedder.model}`,
  );
  console.log(`commit: ${commit}${dirty ? ' (dirty)' : ''}   date: ${date}`);
  console.log(
    `Questions: ${metrics.questions} (${metrics.answerable} answerable, ${metrics.unanswerable} unanswerable)`,
  );
  console.log(
    `Citation validity:  ${fmt(metrics.citationValidity)} (${metrics.validCitations}/${metrics.proposedCitations})`,
  );
  console.log(
    `Cites expected norm: ${fmt(metrics.citesExpected)} of ${metrics.answeredAnswerable} answered answerable`,
  );
  console.log(`Refusal precision:  ${fmt(metrics.refusalPrecision)}`);
  console.log(`Refusal recall:     ${fmt(metrics.refusalRecall)}`);

  const reasons = new Map<string, number>();
  for (const c of cases) {
    if (c.diagnostics.reason)
      reasons.set(c.diagnostics.reason, (reasons.get(c.diagnostics.reason) ?? 0) + 1);
  }
  console.log(`Refusal reasons: ${[...reasons].map(([r, n]) => `${r}=${n}`).join(', ') || 'none'}`);

  await mkdir(join('eval', 'results'), { recursive: true });
  const safeModel = label.model.replace(/[^A-Za-z0-9._-]+/g, '_');
  const file = join('eval', 'results', `answers-${date}-${label.provider}-${safeModel}.json`);
  await writeFile(
    file,
    `${JSON.stringify(
      {
        date,
        commit,
        dirty,
        answerProvider: label.provider,
        answerModel: label.model,
        answerHost: label.host ?? null,
        embedder: embedder.model,
        metrics,
        perQuestion: cases.map((c) => ({
          id: c.question.id,
          answerable: c.question.answerable,
          refused: c.response.refused,
          reason: c.diagnostics.reason ?? null,
          proposedCitations: c.diagnostics.proposedCitations,
          validCitations: c.diagnostics.validCitations,
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
