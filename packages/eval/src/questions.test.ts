import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  FULL_SET_LIMITS,
  LEXICAL_SET_LIMITS,
  loadQuestions,
  selectSplit,
  validateAgainstCorpus,
  validateLexical,
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

describe('selectSplit', () => {
  const q = (id: string): Question => ({
    id,
    question: 'F?',
    answerable: true,
    expected: ['x'],
    source: 's',
    needs_review: false,
  });
  const all = ['q001', 'q002', 'q003', 'q004', 'q005'].map(q);

  it('puts odd question numbers in the development part and even ones in the held-out part', () => {
    expect(selectSplit(all, 'dev').map((x) => x.id)).toEqual(['q001', 'q003', 'q005']);
    expect(selectSplit(all, 'heldout').map((x) => x.id)).toEqual(['q002', 'q004']);
  });

  it('keeps every question for "all" and never shares a question between the parts', () => {
    expect(selectSplit(all, 'all')).toHaveLength(5);
    const dev = new Set(selectSplit(all, 'dev').map((x) => x.id));
    expect(selectSplit(all, 'heldout').some((x) => dev.has(x.id))).toBe(false);
  });
});

describe('eval/lexical-questions.jsonl', () => {
  it('has the right shape: answerable questions with a style, quoted terms and a source', async () => {
    const questions = await loadQuestions(join(root, 'eval', 'lexical-questions.jsonl'));
    expect(validateStructure(questions, LEXICAL_SET_LIMITS)).toEqual([]);
    expect(questions.every((q) => q.style && q.terms && q.terms.length > 0)).toBe(true);
    expect(new Set(questions.map((q) => q.style))).toEqual(new Set(['term', 'number', 'citation']));
  });

  it('puts every style into both the development and the held-out part', async () => {
    const questions = await loadQuestions(join(root, 'eval', 'lexical-questions.jsonl'));
    for (const split of ['dev', 'heldout'] as const) {
      const styles = new Set(selectSplit(questions, split).map((q) => q.style));
      expect(styles).toEqual(new Set(['term', 'number', 'citation']));
    }
  });
});

describe('validateLexical', () => {
  const units = [
    {
      id: 'g/§ 1/Abs. 1',
      label: '§ 1 Abs. 1 G',
      title: 'Eins',
      text: 'Gelangensbestätigung ist zu führen.',
    },
    {
      id: 'g/§ 2/Abs. 1',
      label: '§ 2 Abs. 1 G',
      title: 'Zwei',
      text: 'Die Gelangensbestätigung entfällt.',
    },
    { id: 'g/§ 3/Abs. 1', label: '§ 3 Abs. 1 G', title: 'Drei', text: 'Etwas anderes.' },
  ];
  const q = (over: Partial<Question>): Question => ({
    id: 'l001',
    question: 'Was gilt für die Gelangensbestätigung?',
    answerable: true,
    expected: ['g/§ 1/Abs. 1'],
    source: 's',
    style: 'term',
    terms: ['Gelangensbestätigung'],
    needs_review: false,
    ...over,
  });

  it('flags a term that another unrelated unit contains too (ambiguous)', () => {
    expect(validateLexical([q({})], units).join()).toMatch(/also contained in g\/§ 2\/Abs\. 1/);
  });

  it('accepts it when the other unit is listed as not expected with a reason', () => {
    const ok = q({ not_expected: [{ id: 'g/§ 2/Abs. 1', reason: 'says the opposite' }] });
    expect(validateLexical([ok], units)).toEqual([]);
  });

  it('requires a reason and an existing unit for not_expected', () => {
    const bad = q({ not_expected: [{ id: 'g/§ 2/Abs. 1', reason: ' ' }] });
    expect(validateLexical([bad], units).join()).toMatch(/must exist and give a reason/);
  });

  it('requires the question to quote its terms and the terms to be in the expected unit', () => {
    expect(validateLexical([q({ question: 'Was gilt?' })], units).join()).toMatch(/does not quote/);
    expect(validateLexical([q({ expected: ['g/§ 3/Abs. 1'] })], units).join()).toMatch(
      /does not occur in an expected unit/,
    );
  });

  it('checks a citation against the label of the expected unit', () => {
    const ok = q({
      style: 'citation',
      question: 'Was regelt § 3 Abs. 1 G?',
      terms: ['§ 3 Abs. 1 G'],
      expected: ['g/§ 3/Abs. 1'],
    });
    expect(validateLexical([ok], units)).toEqual([]);
    const wrong = { ...ok, expected: ['g/§ 1/Abs. 1'] };
    expect(validateLexical([wrong], units).join()).toMatch(/not the label of an expected unit/);
  });
});
