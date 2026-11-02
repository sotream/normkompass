import type { Question } from './questions.js';

/**
 * A returned unit counts as a hit for an expected unit when it is that unit
 * or one of its ancestors (the parent Absatz or the § that contains it).
 */
export function isHit(returnedUnitId: string, expectedUnitId: string): boolean {
  return returnedUnitId === expectedUnitId || expectedUnitId.startsWith(`${returnedUnitId}/`);
}

export interface QuestionResult {
  id: string;
  question: string;
  expected: string[];
  /** Unit ids in rank order (a unit appears once, at its best rank). */
  returned: string[];
  recallAt5: number;
  /** Reciprocal rank of the first hit, 0 if none. */
  reciprocalRank: number;
  firstHitRank: number | null;
}

export interface Metrics {
  questions: number;
  recallAt5: number;
  mrr: number;
}

export function scoreQuestion(question: Question, returnedUnitIds: string[]): QuestionResult {
  const returned = [...new Set(returnedUnitIds)];
  const hitsAt5 = question.expected.filter((e) => returned.slice(0, 5).some((r) => isHit(r, e)));
  const first = returned.findIndex((r) => question.expected.some((e) => isHit(r, e)));
  return {
    id: question.id,
    question: question.question,
    expected: question.expected,
    returned,
    recallAt5: question.expected.length === 0 ? 0 : hitsAt5.length / question.expected.length,
    reciprocalRank: first === -1 ? 0 : 1 / (first + 1),
    firstHitRank: first === -1 ? null : first + 1,
  };
}

/** Recall@5 and MRR over the answerable questions. */
export function aggregate(results: QuestionResult[]): Metrics {
  const n = results.length;
  const mean = (f: (r: QuestionResult) => number): number =>
    n === 0 ? 0 : results.reduce((s, r) => s + f(r), 0) / n;
  return { questions: n, recallAt5: mean((r) => r.recallAt5), mrr: mean((r) => r.reciprocalRank) };
}
