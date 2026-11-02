import type { AnswerPipeline } from '@normkompass/answer';
import { scoreAnswers, type AnswerCase, type AnswerMetrics } from './answer-metrics.js';
import type { Question } from './questions.js';

/** Runs every question (answerable or not) through the full ask pipeline, one at a time. */
export async function evaluateAnswers(
  pipeline: AnswerPipeline,
  questions: Question[],
  onProgress?: (done: number, total: number) => void,
): Promise<{ metrics: AnswerMetrics; cases: AnswerCase[] }> {
  const cases: AnswerCase[] = [];
  for (const question of questions) {
    const { response, diagnostics } = await pipeline.ask(question.question);
    cases.push({ question, response, diagnostics });
    onProgress?.(cases.length, questions.length);
  }
  return { metrics: scoreAnswers(cases), cases };
}
