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
  /** Lexical questions only: what kind of exact reference the question quotes. */
  style?: 'term' | 'number' | 'citation';
  /** Lexical questions only: the exact terms, numbers or citation label quoted in the question. */
  terms?: string[];
  /**
   * Lexical questions only: units that contain the quoted terms but do not answer the question, each with the
   * reason, so that an apparent ambiguity has been looked at and decided.
   */
  not_expected?: { id: string; reason: string }[];
  /** External questions only: written by another model from text it was given, not by this repository's author. */
  origin?: 'external';
  /** External questions only: the label of the writer, as reported by the repository owner. */
  writer?: string;
  /** Why a question was flagged `needs_review` by the conversion. */
  review_note?: string;
  /** Held-out v2 questions only: who wrote the question and from what (see eval/PROTOCOL.md). */
  provenance?: Provenance;
}

/** Who wrote a held-out v2 question. Required for every question of that set. */
export interface Provenance {
  author_kind: 'human' | 'lawyer' | 'model';
  /** Name of the person, or the model's product name. */
  author: string;
  /** Exact model identifier; required when `author_kind` is `model`. */
  model?: string;
  /** ISO date (YYYY-MM-DD) on which the question was written. */
  written_on: string;
  /** What the writer looked at: a corpus passage, or none (own knowledge, real user query). */
  basis: 'corpus-passage' | 'own-knowledge' | 'real-query';
  /** Whether a second person checked the expected unit; `null` if nobody did. */
  reviewed_by: string | null;
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

/** The lexical set has answerable questions only. */
export const LEXICAL_SET_LIMITS: SetLimits = {
  minAnswerable: 20,
  maxAnswerable: 40,
  minUnanswerable: 0,
  maxUnanswerable: 0,
};

/** The external set has answerable questions only and is larger than the hand-written lexical set. */
export const EXTERNAL_SET_LIMITS: SetLimits = {
  minAnswerable: 20,
  maxAnswerable: 200,
  minUnanswerable: 0,
  maxUnanswerable: 0,
};

/** The held-out v2 set has answerable questions only and a floor of 30 (eval/PROTOCOL.md). */
export const HELDOUT_V2_LIMITS: SetLimits = {
  minAnswerable: 30,
  maxAnswerable: 200,
  minUnanswerable: 0,
  maxUnanswerable: 0,
};

/** Model families that built or are used inside this system; they may not write held-out v2 questions. */
const EXCLUDED_AUTHOR_MODELS = /claude|anthropic/i;

const normalizeText = (t: string): string => t.toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * Checks the provenance of every held-out v2 question: author recorded, model authors named and not from the
 * excluded families, a real date, and no question text that already occurs in another set. Messages carry
 * question ids only, never question text.
 */
export function validateProvenance(questions: Question[], otherSets: Question[]): string[] {
  const errors: string[] = [];
  const seen = new Set(otherSets.map((q) => normalizeText(q.question)));
  for (const q of questions) {
    const p: Partial<Provenance> | undefined = q.provenance;
    if (!p) {
      errors.push(`${q.id}: provenance is missing`);
      continue;
    }
    if (!['human', 'lawyer', 'model'].includes(p.author_kind ?? ''))
      errors.push(`${q.id}: provenance.author_kind must be human, lawyer or model`);
    if (!p.author?.trim()) errors.push(`${q.id}: provenance.author is empty`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(p.written_on ?? ''))
      errors.push(`${q.id}: provenance.written_on must be YYYY-MM-DD`);
    if (!['corpus-passage', 'own-knowledge', 'real-query'].includes(p.basis ?? ''))
      errors.push(`${q.id}: provenance.basis is not one of the allowed values`);
    if (p.reviewed_by === undefined)
      errors.push(`${q.id}: provenance.reviewed_by must be set (null if nobody)`);
    if (p.author_kind === 'model') {
      if (!p.model?.trim()) errors.push(`${q.id}: a model author needs provenance.model`);
      else if (EXCLUDED_AUTHOR_MODELS.test(`${p.model} ${p.author}`))
        errors.push(
          `${q.id}: the author model belongs to the system under test and is not allowed`,
        );
    }
    if (seen.has(normalizeText(q.question)))
      errors.push(`${q.id}: the question text already occurs in another question set`);
    seen.add(normalizeText(q.question));
  }
  return errors;
}

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

const related = (a: string, b: string): boolean =>
  a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`);

/**
 * Checks a lexical question against the corpus: it quotes its terms verbatim, the terms really occur in the
 * expected unit (or, for a citation, equal the label of the expected unit), and no unrelated unit contains all
 * the terms, which would make the expected answer ambiguous.
 */
export function validateLexical(
  questions: Question[],
  units: { id: string; label: string; text: string; title: string }[],
  options: { ambiguity?: boolean } = {},
): string[] {
  const errors: string[] = [];
  const byId = new Map(units.map((u) => [u.id, u]));
  const lower = (t: string): string => t.toLowerCase();
  for (const q of questions) {
    if (!q.style || !q.terms || q.terms.length === 0) {
      errors.push(`${q.id}: lexical question needs a style and terms`);
      continue;
    }
    for (const term of q.terms) {
      if (!lower(q.question).includes(lower(term))) {
        errors.push(`${q.id}: the question does not quote "${term}" verbatim`);
      }
    }
    const expected = q.expected.flatMap((id) => {
      const u = byId.get(id);
      return u ? [u] : [];
    });
    if (q.style === 'citation') {
      if (!expected.some((u) => u.label === q.terms?.[0])) {
        errors.push(`${q.id}: citation "${q.terms[0]}" is not the label of an expected unit`);
      }
      continue;
    }
    for (const term of q.terms) {
      if (!expected.some((u) => lower(`${u.title} ${u.text}`).includes(lower(term)))) {
        errors.push(`${q.id}: "${term}" does not occur in an expected unit`);
      }
    }
    for (const n of q.not_expected ?? []) {
      if (!byId.has(n.id) || n.reason.trim() === '') {
        errors.push(`${q.id}: not_expected "${n.id}" must exist and give a reason`);
      }
    }
    if (options.ambiguity === false) continue;
    const others = units
      .filter(
        (u) =>
          !q.expected.some((e) => related(u.id, e)) &&
          !(q.not_expected ?? []).some((n) => related(u.id, n.id)) &&
          (q.terms ?? []).every((t) => lower(`${u.title} ${u.text}`).includes(lower(t))),
      )
      .map((u) => u.id);
    if (others.length > 0) {
      errors.push(`${q.id}: also contained in ${others.slice(0, 3).join(', ')} (ambiguous)`);
    }
  }
  return errors;
}
