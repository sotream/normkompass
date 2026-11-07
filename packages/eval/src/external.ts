import { mulberry32, bootstrapMeanInterval, reciprocalRanks } from './compare.js';
import { validateLexical, type Question } from './questions.js';

/** The part of a corpus unit that the sampling and conversion need. */
export interface SampleUnit {
  id: string;
  documentId: string;
  label: string;
  title: string;
  text: string;
}

export interface SampleFile {
  seed: number;
  /** For each slot, the units of its batch in order: `u01`, `u02`, ... */
  slots: Record<string, { ref: string; unit: string }[]>;
}

export const MIN_UNIT_CHARS = 60;
export const MAX_UNIT_CHARS = 1200;
export const STYLES = ['term', 'number', 'citation'] as const;

/**
 * Draws a reproducible sample of units for the writers: eligible units (self-contained, not too long) are dealt
 * one law at a time, so every law is in the sample, and then split into one batch per slot without overlap.
 */
export function sampleBatches(
  units: SampleUnit[],
  options: { seed: number; slots: string[]; perSlot: number },
): SampleFile {
  const eligible = units.filter(
    (u) => u.text.trim().length >= MIN_UNIT_CHARS && u.text.length <= MAX_UNIT_CHARS,
  );
  const need = options.slots.length * options.perSlot;
  if (eligible.length < need) {
    throw new Error(`Only ${eligible.length} eligible units, ${need} needed`);
  }
  const rand = mulberry32(options.seed);
  const byDocument = new Map<string, SampleUnit[]>();
  for (const u of [...eligible].sort((a, b) => a.id.localeCompare(b.id))) {
    byDocument.set(u.documentId, [...(byDocument.get(u.documentId) ?? []), u]);
  }
  const documents = [...byDocument.keys()].sort();
  const picked: SampleUnit[] = [];
  while (picked.length < need) {
    for (const doc of documents) {
      const pool = byDocument.get(doc) ?? [];
      if (pool.length === 0 || picked.length >= need) continue;
      const i = Math.floor(rand() * pool.length);
      const [unit] = pool.splice(i, 1);
      if (unit) picked.push(unit);
    }
  }
  const slots: SampleFile['slots'] = Object.fromEntries(options.slots.map((s) => [s, []]));
  picked.forEach((unit, i) => {
    // Shift the slot by one per round of laws, so that every slot sees every law and not just one.
    const slot = options.slots[(i + Math.floor(i / documents.length)) % options.slots.length] ?? '';
    const batch = slots[slot] ?? [];
    slots[slot] = batch;
    batch.push({ ref: `u${String(batch.length + 1).padStart(2, '0')}`, unit: unit.id });
  });
  return { seed: options.seed, slots };
}

/** The text a writer receives: only corpus text and the reference of each unit, nothing about the system. */
export function renderBatch(
  slot: string,
  batch: SampleFile['slots'][string],
  units: SampleUnit[],
): string {
  const byId = new Map(units.map((u) => [u.id, u]));
  const parts = [`# Batch ${slot}`, ''];
  for (const { ref, unit } of batch) {
    const u = byId.get(unit);
    if (!u) throw new Error(`Unknown unit ${unit}`);
    parts.push(
      `## ${ref}`,
      `Citation label: ${u.label}`,
      `Title: ${u.title}`,
      '',
      u.text.trim(),
      '',
    );
  }
  return parts.join('\n');
}

export interface RawFile {
  slot: string;
  writer: string;
  lines: string[];
}

export interface Rejected {
  writer: string;
  line: number;
  reason: string;
  raw: string;
}

export interface Converted {
  questions: Question[];
  rejected: Rejected[];
}

const normalize = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

function jaccard(a: string, b: string): number {
  const x = new Set(normalize(a).split(' '));
  const y = new Set(normalize(b).split(' '));
  const common = [...x].filter((w) => y.has(w)).length;
  return common / (x.size + y.size - common || 1);
}

/** A question counts as a copy when it equals an existing one after normalizing or shares 85% of its words. */
export function isCopy(question: string, existing: string[]): boolean {
  const n = normalize(question);
  return existing.some((e) => normalize(e) === n || jaccard(e, question) >= 0.85);
}

/**
 * Turns the stored raw output of the writers into the external question set. A line that cannot be used is
 * returned with its reason, never dropped silently; a question that is valid but ambiguous is kept with
 * `needs_review` and the reason.
 */
export function convertExternal(
  files: RawFile[],
  sample: SampleFile,
  units: SampleUnit[],
  existing: string[],
): Converted {
  const byId = new Map(units.map((u) => [u.id, u]));
  const rejected: Rejected[] = [];
  const accepted: Question[] = [];
  const seen = [...existing];
  const reject = (file: RawFile, line: number, reason: string, raw: string): undefined => {
    rejected.push({ writer: file.writer, line, reason, raw });
    return undefined;
  };

  for (const file of [...files].sort((a, b) => a.slot.localeCompare(b.slot))) {
    const batch = sample.slots[file.slot];
    if (!batch) {
      reject(file, 0, `unknown slot "${file.slot}"`, '');
      continue;
    }
    file.lines.forEach((raw, i) => {
      if (raw.trim() === '') return;
      const line = i + 1;
      let data: Record<string, unknown>;
      try {
        data = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        reject(file, line, 'invalid JSON', raw);
        return;
      }
      const { unit: ref, question, style, terms } = data;
      const entry = batch.find((b) => b.ref === ref);
      if (!entry) {
        reject(file, line, `unit "${String(ref)}" is not in batch ${file.slot}`, raw);
        return;
      }
      if (typeof question !== 'string' || question.trim() === '') {
        reject(file, line, 'missing question', raw);
        return;
      }
      if (!STYLES.includes(style as (typeof STYLES)[number])) {
        reject(file, line, `style must be one of ${STYLES.join(', ')}`, raw);
        return;
      }
      if (
        !Array.isArray(terms) ||
        terms.length === 0 ||
        !terms.every((t) => typeof t === 'string')
      ) {
        reject(file, line, 'terms must be a non-empty list of strings', raw);
        return;
      }
      if (isCopy(question, seen)) {
        reject(file, line, 'copy of an existing question', raw);
        return;
      }

      const unit = byId.get(entry.unit);
      if (!unit) {
        reject(file, line, `unit ${entry.unit} is not in the corpus`, raw);
        return;
      }
      const candidate: Question = {
        id: 'pending',
        question: question.trim(),
        answerable: true,
        expected: [unit.id],
        source: unit.label,
        style: style as (typeof STYLES)[number],
        terms: terms,
        needs_review: false,
        origin: 'external',
        writer: file.writer,
      };
      const problems = validateLexical([candidate], units);
      const hard = problems.filter((p) => !p.includes('(ambiguous)'));
      if (hard.length > 0) {
        reject(file, line, hard.map((p) => p.replace(/^pending: /, '')).join('; '), raw);
        return;
      }
      if (problems.length > 0) {
        candidate.needs_review = true;
        candidate.review_note = problems.map((p) => p.replace(/^pending: /, '')).join('; ');
      }
      seen.push(candidate.question);
      accepted.push(candidate);
    });
  }
  const questions = accepted.map((q, i) => ({ ...q, id: `e${String(i + 1).padStart(3, '0')}` }));
  return { questions, rejected };
}

export interface WriterRow {
  writer: string;
  questions: number;
  needsReview: number;
  recallAt5: number;
  mrr: number;
}

/** Per-writer and overall scores of a stored result; the overall row carries a 95% bootstrap interval for MRR. */
export function summarizeByWriter(
  questions: Question[],
  perQuestion: { id: string; firstHitRank: number | null; recallAt5: number }[],
): { rows: WriterRow[]; overall: WriterRow & { mrrLo: number; mrrHi: number } } {
  const writerOf = new Map(questions.map((q) => [q.id, q.writer ?? 'unknown']));
  const reviewOf = new Map(questions.map((q) => [q.id, q.needs_review]));
  const writers = [...new Set(perQuestion.map((r) => writerOf.get(r.id) ?? 'unknown'))].sort();
  const summarize = (name: string, rows: typeof perQuestion): WriterRow => ({
    writer: name,
    questions: rows.length,
    needsReview: rows.filter((r) => reviewOf.get(r.id)).length,
    recallAt5: rows.reduce((s, r) => s + r.recallAt5, 0) / (rows.length || 1),
    mrr: reciprocalRanks(rows).reduce((s, r) => s + r, 0) / (rows.length || 1),
  });
  const rows = writers.map((w) =>
    summarize(
      w,
      perQuestion.filter((r) => (writerOf.get(r.id) ?? 'unknown') === w),
    ),
  );
  const interval = bootstrapMeanInterval(reciprocalRanks(perQuestion));
  return {
    rows,
    overall: { ...summarize('all', perQuestion), mrrLo: interval.lo, mrrHi: interval.hi },
  };
}
