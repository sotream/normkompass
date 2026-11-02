import type { AnswerResponse, Diagnostics } from '@normkompass/answer';
import { isHit } from './metrics.js';
import type { Question } from './questions.js';

export interface AnswerCase {
  question: Question;
  response: AnswerResponse;
  diagnostics: Diagnostics;
}

export interface AnswerMetrics {
  questions: number;
  answerable: number;
  unanswerable: number;
  /** Citations the model proposed, over all questions, and how many passed verification. */
  proposedCitations: number;
  validCitations: number;
  /** validCitations / proposedCitations; null if the model proposed none. */
  citationValidity: number | null;
  /** Answered answerable questions, and the share whose verified citations include an expected norm. */
  answeredAnswerable: number;
  citesExpected: number | null;
  /** "Refused" is the positive class. */
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
  refusalPrecision: number | null;
  refusalRecall: number | null;
}

const ratio = (num: number, den: number): number | null => (den === 0 ? null : num / den);

export function scoreAnswers(cases: AnswerCase[]): AnswerMetrics {
  let proposed = 0;
  let valid = 0;
  let tp = 0;
  let fp = 0;
  let fn = 0;
  let answeredAnswerable = 0;
  let citingExpected = 0;
  for (const { question, response, diagnostics } of cases) {
    proposed += diagnostics.proposedCitations;
    valid += diagnostics.validCitations;
    if (question.answerable) {
      if (response.refused) fp++;
      else {
        answeredAnswerable++;
        const cited = diagnostics.citedUnitIds;
        if (question.expected.some((e) => cited.some((c) => isHit(c, e)))) citingExpected++;
      }
    } else if (response.refused) tp++;
    else fn++;
  }
  const answerable = cases.filter((c) => c.question.answerable).length;
  return {
    questions: cases.length,
    answerable,
    unanswerable: cases.length - answerable,
    proposedCitations: proposed,
    validCitations: valid,
    citationValidity: ratio(valid, proposed),
    answeredAnswerable,
    citesExpected: ratio(citingExpected, answeredAnswerable),
    truePositives: tp,
    falsePositives: fp,
    falseNegatives: fn,
    refusalPrecision: ratio(tp, tp + fp),
    refusalRecall: ratio(tp, tp + fn),
  };
}
