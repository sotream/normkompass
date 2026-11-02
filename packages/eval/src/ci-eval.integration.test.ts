import { join } from 'node:path';
import {
  HashingEmbedder,
  HybridSearch,
  createTestDb,
  DATABASE_URL,
  fixtureUnits,
  indexUnits,
  type Pool,
} from '@normkompass/search';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { evaluateRetrieval } from './evaluate.js';
import { loadQuestions, validateAgainstCorpus, validateStructure } from './questions.js';

const CI_LIMITS = { minAnswerable: 10, maxAnswerable: 30, minUnanswerable: 0, maxUnanswerable: 0 };

/** Thresholds for the fake-embedder CI subset; a drop below them fails CI. */
export const CI_THRESHOLDS = { recallAt5: 0.7, mrr: 0.5 };

describe.skipIf(!DATABASE_URL)('CI retrieval eval (fixtures, fake embedder)', () => {
  let pool: Pool;
  let drop: () => Promise<void>;
  const units = fixtureUnits();

  beforeAll(async () => {
    ({ pool, drop } = await createTestDb());
    await indexUnits(pool, new HashingEmbedder(), units);
  });
  afterAll(async () => {
    await drop();
  });

  it('uses a valid question set whose norms exist in the fixtures', async () => {
    const questions = await loadQuestions(
      join(import.meta.dirname, '../../../eval/ci-questions.jsonl'),
    );
    expect(validateStructure(questions, CI_LIMITS)).toEqual([]);
    expect(validateAgainstCorpus(questions, units)).toEqual([]);
  });

  it('keeps recall@5 and MRR above the CI thresholds', async () => {
    const questions = await loadQuestions(
      join(import.meta.dirname, '../../../eval/ci-questions.jsonl'),
    );
    const { metrics, results } = await evaluateRetrieval(
      new HybridSearch(pool, new HashingEmbedder()),
      questions,
    );
    const misses = results.filter((r) => r.firstHitRank === null || r.firstHitRank > 5);
    expect(
      metrics.recallAt5,
      `recall@5 ${metrics.recallAt5.toFixed(3)}; misses: ${misses.map((m) => m.id).join(', ')}`,
    ).toBeGreaterThanOrEqual(CI_THRESHOLDS.recallAt5);
    expect(metrics.mrr, `MRR ${metrics.mrr.toFixed(3)}`).toBeGreaterThanOrEqual(CI_THRESHOLDS.mrr);
  });
});
