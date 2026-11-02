import { join } from 'node:path';
import { AnswerPipeline, ScriptedModel, answerFromFirstSource } from '@normkompass/answer';
import {
  DATABASE_URL,
  HashingEmbedder,
  HybridSearch,
  createTestDb,
  fixtureUnits,
  indexUnits,
  type Pool,
} from '@normkompass/search';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { evaluateAnswers } from './evaluate-answers.js';
import { loadQuestions, type Question } from './questions.js';

/** Thresholds for the scripted-model CI run; the scripted model refuses exactly the unanswerable questions. */
export const CI_ANSWER_THRESHOLDS = { citesExpected: 0.5 };

describe.skipIf(!DATABASE_URL)('CI answer eval (fixtures, scripted model, no network)', () => {
  let pool: Pool;
  let drop: () => Promise<void>;
  let questions: Question[];
  let retriever: HybridSearch;

  beforeAll(async () => {
    ({ pool, drop } = await createTestDb());
    await indexUnits(pool, new HashingEmbedder(), fixtureUnits());
    retriever = new HybridSearch(pool, new HashingEmbedder());
    questions = await loadQuestions(join(import.meta.dirname, '../../../eval/ci-questions.jsonl'));
  });
  afterAll(async () => {
    await drop();
  });

  it('runs the whole pipeline and verifies every citation of a faithful model', async () => {
    const unanswerable = new Set(questions.filter((q) => !q.answerable).map((q) => q.question));
    const model = new ScriptedModel(({ question, sources }) =>
      unanswerable.has(question)
        ? '{"refused":true,"answer":"","citations":[]}'
        : answerFromFirstSource(sources),
    );
    const { metrics } = await evaluateAnswers(new AnswerPipeline(retriever, model), questions);
    expect(metrics.questions).toBe(questions.length);
    expect(metrics.citationValidity).toBe(1);
    expect(metrics.refusalPrecision).toBe(1);
    expect(metrics.refusalRecall).toBe(1);
    expect(
      metrics.citesExpected ?? 0,
      `citesExpected ${String(metrics.citesExpected)}`,
    ).toBeGreaterThanOrEqual(CI_ANSWER_THRESHOLDS.citesExpected);
  });

  it('detects a model that misquotes: validity drops and valid answers are refused', async () => {
    const sloppy = new ScriptedModel(({ sources }) => {
      const first = sources[0];
      return JSON.stringify({
        refused: false,
        answer: 'Antwort.',
        citations: [
          { chunk: 1, quote: `${first?.hit.text.slice(0, 40) ?? ''} und noch ein erfundenes Wort` },
        ],
      });
    });
    const { metrics } = await evaluateAnswers(new AnswerPipeline(retriever, sloppy), questions);
    expect(metrics.citationValidity).toBe(0);
    expect(metrics.falsePositives).toBe(questions.filter((q) => q.answerable).length);
    expect(metrics.refusalPrecision).toBeLessThan(1);
    expect(metrics.refusalRecall).toBe(1);
  });

  it('detects a model that answers unanswerable questions', async () => {
    const eager = new ScriptedModel(({ sources }) => answerFromFirstSource(sources));
    const { metrics } = await evaluateAnswers(new AnswerPipeline(retriever, eager), questions);
    expect(metrics.refusalRecall).toBe(0);
    expect(metrics.falseNegatives).toBe(questions.filter((q) => !q.answerable).length);
  });
});
