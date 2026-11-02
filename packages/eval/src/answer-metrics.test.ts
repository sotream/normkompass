import type { AnswerResponse, Diagnostics } from '@normkompass/answer';
import { describe, expect, it } from 'vitest';
import { scoreAnswers, type AnswerCase } from './answer-metrics.js';
import type { Question } from './questions.js';

const answerableQ = (expected: string[] = ['a/§ 1/Abs. 1']): Question => ({
  id: 'a',
  question: 'Frage?',
  answerable: true,
  expected,
  source: 's',
  needs_review: false,
});
const unanswerableQ: Question = {
  id: 'u',
  question: 'Frage?',
  answerable: false,
  expected: [],
  absent_terms: ['x'],
  needs_review: false,
};
const REFUSED: AnswerResponse = { answer: '', citations: [], refused: true, stand: null };
const ANSWERED: AnswerResponse = { answer: 'A', citations: [], refused: false, stand: 's' };
const diag = (over: Partial<Diagnostics> = {}): Diagnostics => ({
  retrieved: 5,
  proposedCitations: 0,
  validCitations: 0,
  citedUnitIds: [],
  ...over,
});
const c = (question: Question, response: AnswerResponse, diagnostics = diag()): AnswerCase => ({
  question,
  response,
  diagnostics,
});

describe('scoreAnswers', () => {
  it('gives 1.0 everywhere for perfect behavior', () => {
    const m = scoreAnswers([
      c(
        answerableQ(),
        ANSWERED,
        diag({ proposedCitations: 2, validCitations: 2, citedUnitIds: ['a/§ 1/Abs. 1'] }),
      ),
      c(unanswerableQ, REFUSED),
    ]);
    expect(m.citationValidity).toBe(1);
    expect(m.citesExpected).toBe(1);
    expect(m.refusalPrecision).toBe(1);
    expect(m.refusalRecall).toBe(1);
  });

  it('computes citation validity over everything the model proposed', () => {
    const m = scoreAnswers([
      c(answerableQ(), REFUSED, diag({ proposedCitations: 3, validCitations: 1 })),
      c(answerableQ(), ANSWERED, diag({ proposedCitations: 1, validCitations: 1 })),
    ]);
    expect(m.citationValidity).toBeCloseTo(2 / 4);
  });

  it('is null, not 1, when the model proposed no citations', () => {
    expect(scoreAnswers([c(unanswerableQ, REFUSED)]).citationValidity).toBeNull();
  });

  it('lowers refusal precision when an answerable question is refused', () => {
    const m = scoreAnswers([c(unanswerableQ, REFUSED), c(answerableQ(), REFUSED)]);
    expect(m.refusalPrecision).toBe(0.5);
    expect(m.refusalRecall).toBe(1);
    expect(m.falsePositives).toBe(1);
  });

  it('lowers refusal recall when an unanswerable question is answered', () => {
    const m = scoreAnswers([c(unanswerableQ, REFUSED), c(unanswerableQ, ANSWERED)]);
    expect(m.refusalRecall).toBe(0.5);
    expect(m.refusalPrecision).toBe(1);
    expect(m.falseNegatives).toBe(1);
  });

  it('counts a cited parent Absatz as citing the expected Nummer', () => {
    const m = scoreAnswers([
      c(
        answerableQ(['a/§ 1/Abs. 1/Nr. 2']),
        ANSWERED,
        diag({ proposedCitations: 1, validCitations: 1, citedUnitIds: ['a/§ 1/Abs. 1'] }),
      ),
      c(
        answerableQ(),
        ANSWERED,
        diag({ proposedCitations: 1, validCitations: 1, citedUnitIds: ['a/§ 9/Abs. 1'] }),
      ),
    ]);
    expect(m.answeredAnswerable).toBe(2);
    expect(m.citesExpected).toBe(0.5);
  });

  it('reports null refusal metrics when there is nothing to compute', () => {
    const m = scoreAnswers([c(answerableQ(), ANSWERED)]);
    expect(m.refusalPrecision).toBeNull();
    expect(m.refusalRecall).toBeNull();
  });
});
