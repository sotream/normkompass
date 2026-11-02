import { createHash } from 'node:crypto';
import type { CorpusUnit } from '@normkompass/corpus';

/** Longest chunk text; units above it are split into parts. */
export const MAX_CHUNK_CHARS = 1500;

export interface Chunk {
  id: string;
  unitId: string;
  part: number;
  parts: number;
  unit: CorpusUnit;
  /** Original text of this part (a contiguous slice of the unit text). */
  text: string;
  contentHash: string;
}

/** Splits text into contiguous slices of at most `max` characters, preferring line then word boundaries. */
export function splitText(text: string, max: number = MAX_CHUNK_CHARS): string[] {
  const parts: string[] = [];
  let start = 0;
  while (text.length - start > max) {
    const window = text.slice(start, start + max);
    let cut = window.lastIndexOf('\n') + 1;
    if (cut < max / 2) cut = window.lastIndexOf(' ') + 1;
    if (cut < max / 2) cut = max;
    parts.push(text.slice(start, start + cut));
    start += cut;
  }
  parts.push(text.slice(start));
  return parts;
}

export function chunkUnit(unit: CorpusUnit, max: number = MAX_CHUNK_CHARS): Chunk[] {
  const texts = splitText(unit.text, max);
  return texts.map((text, i) => ({
    id: `${unit.id}#${i + 1}`,
    unitId: unit.id,
    part: i + 1,
    parts: texts.length,
    unit,
    text,
    contentHash: createHash('sha256')
      .update([unit.label, unit.title, unit.url, unit.stand ?? '', text].join('\u0000'))
      .digest('hex'),
  }));
}

/** Text that is embedded: citation label and title as context, then the chunk text. */
export function embeddingInput(chunk: Chunk): string {
  return `${chunk.unit.label} ${chunk.unit.title}\n${chunk.text}`;
}
