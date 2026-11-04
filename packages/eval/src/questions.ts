import { readFile } from 'node:fs/promises';

export interface Question {
  id: string;
  question: string;
  answerable: boolean;
  /** Unit ids (`<document>/<path>`) that answer the question; empty when unanswerable. */
  expected: string[];
  /** Human-readable place in the corpus the question was derived from. */
  source?: string;
  /** Words that must not occur anywhere in the corpus; proves a question is unanswerable. */
  absent_terms?: string[];
  needs_review: boolean;
}

export interface SetLimits {
  minAnswerable: number;
  maxAnswerable: number;
  minUnanswerable: number;
  maxUnanswerable: number;
}

export const FULL_SET_LIMITS: SetLimits = {
  minAnswerable: 60,
  maxAnswerable: 100,
  minUnanswerable: 10,
  maxUnanswerable: 15,
};

export async function loadQuestions(path: string): Promise<Question[]> {
  const raw = await readFile(path, 'utf-8');
  return raw
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line, i) => {
      try {
        return JSON.parse(line) as Question;
      } catch {
        throw new Error(`${path}:${i + 1}: invalid JSON`);
      }
    });
}

/** Checks the question set on its own, without the corpus. Returns problems found. */
export function validateStructure(questions: Question[], limits: SetLimits): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const q of questions) {
    if (ids.has(q.id)) errors.push(`${q.id}: duplicate id`);
    ids.add(q.id);
    if (q.question.trim() === '') errors.push(`${q.id}: empty question`);
    if (typeof q.needs_review !== 'boolean') errors.push(`${q.id}: needs_review must be boolean`);
    if (q.answerable) {
      if (q.expected.length === 0)
        errors.push(`${q.id}: answerable question has no expected norms`);
      if (!q.source) errors.push(`${q.id}: answerable question has no source place`);
    } else {
      if (q.expected.length > 0) errors.push(`${q.id}: unanswerable question lists expected norms`);
      if (!q.absent_terms || q.absent_terms.length === 0) {
        errors.push(`${q.id}: unanswerable question needs absent_terms`);
      }
    }
  }
  const answerable = questions.filter((q) => q.answerable).length;
  const unanswerable = questions.length - answerable;
  if (answerable < limits.minAnswerable || answerable > limits.maxAnswerable) {
    errors.push(
      `${answerable} answerable questions, expected ${limits.minAnswerable}-${limits.maxAnswerable}`,
    );
  }
  if (unanswerable < limits.minUnanswerable || unanswerable > limits.maxUnanswerable) {
    errors.push(
      `${unanswerable} unanswerable questions, expected ${limits.minUnanswerable}-${limits.maxUnanswerable}`,
    );
  }
  return errors;
}

/** Checks the questions against the parsed corpus: expected units exist, absent terms are absent. */
export function validateAgainstCorpus(
  questions: Question[],
  units: { id: string; text: string; title: string }[],
): string[] {
  const errors: string[] = [];
  const ids = new Set(units.map((u) => u.id));
  const haystack = units
    .map((u) => `${u.title}\n${u.text}`)
    .join('\n')
    .toLowerCase();
  for (const q of questions) {
    for (const id of q.expected) {
      if (!ids.has(id)) errors.push(`${q.id}: expected unit "${id}" does not exist in the corpus`);
    }
    for (const term of q.absent_terms ?? []) {
      if (haystack.includes(term.toLowerCase())) {
        errors.push(`${q.id}: absent term "${term}" occurs in the corpus`);
      }
    }
  }
  return errors;
}

export type Split = 'all' | 'dev' | 'heldout';

/**
 * Deterministic split of the questions for tuning: odd question numbers are the development part, even ones
 * the held-out part. Parameters are chosen on the development part only.
 */
export function selectSplit(questions: Question[], split: Split): Question[] {
  if (split === 'all') return questions;
  const odd = (q: Question): boolean => Number(q.id.replace(/\D/g, '')) % 2 === 1;
  return questions.filter((q) => (split === 'dev' ? odd(q) : !odd(q)));
}
