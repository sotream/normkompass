import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  FULL_SET_LIMITS,
  loadQuestions,
  validateAgainstCorpus,
  validateStructure,
  type Question,
} from './questions.js';

const root = join(import.meta.dirname, '../../..');

const answerable = (id: string, expected: string[]): Question => ({
  id,
  question: 'Frage?',
  answerable: true,
  expected,
  source: '§ 1 X',
  needs_review: false,
});
const unanswerable = (id: string, terms: string[]): Question => ({
  id,
  question: 'Frage?',
  answerable: false,
  expected: [],
  absent_terms: terms,
  needs_review: false,
});

describe('eval/questions.jsonl', () => {
  it('has a valid structure and the required size', async () => {
    const questions = await loadQuestions(join(root, 'eval', 'questions.jsonl'));
    expect(validateStructure(questions, FULL_SET_LIMITS)).toEqual([]);
    const count = questions.filter((q) => q.answerable).length;
    expect(count).toBeGreaterThanOrEqual(60);
    expect(count).toBeLessThanOrEqual(100);
  });

  it('writes questions in German with real question marks', async () => {
    const questions = await loadQuestions(join(root, 'eval', 'questions.jsonl'));
    for (const q of questions) expect(q.question.endsWith('?')).toBe(true);
  });
});

describe('validateStructure', () => {
  const limits = { minAnswerable: 1, maxAnswerable: 2, minUnanswerable: 1, maxUnanswerable: 1 };

  it('accepts a valid set', () => {
    expect(
      validateStructure([answerable('a', ['x/§ 1']), unanswerable('b', ['Foo'])], limits),
    ).toEqual([]);
  });

  it('reports duplicate ids, missing expectations, and wrong counts', () => {
    const errors = validateStructure(
      [answerable('a', []), answerable('a', ['x']), answerable('c', ['x'])],
      limits,
    );
    expect(errors.join('\n')).toMatch(/duplicate id/);
    expect(errors.join('\n')).toMatch(/no expected norms/);
    expect(errors.join('\n')).toMatch(/3 answerable questions/);
    expect(errors.join('\n')).toMatch(/0 unanswerable questions/);
  });

  it('requires absent_terms for unanswerable questions', () => {
    const errors = validateStructure([answerable('a', ['x']), unanswerable('b', [])], limits);
    expect(errors.join('\n')).toMatch(/needs absent_terms/);
  });
});

describe('validateAgainstCorpus', () => {
  const units = [{ id: 'x/§ 1/Abs. 1', title: 'Titel', text: 'Die Umsatzsteuer wird erhoben.' }];

  it('fails when an expected norm does not exist', () => {
    const errors = validateAgainstCorpus([answerable('a', ['x/§ 99/Abs. 1'])], units);
    expect(errors).toEqual(['a: expected unit "x/§ 99/Abs. 1" does not exist in the corpus']);
  });

  it('fails when an absent term occurs in the corpus, ignoring case', () => {
    const errors = validateAgainstCorpus([unanswerable('b', ['umsatzsteuer'])], units);
    expect(errors).toEqual(['b: absent term "umsatzsteuer" occurs in the corpus']);
  });

  it('accepts a consistent set', () => {
    expect(
      validateAgainstCorpus(
        [answerable('a', ['x/§ 1/Abs. 1']), unanswerable('b', ['Elterngeld'])],
        units,
      ),
    ).toEqual([]);
  });
});
