import type { CorpusUnit } from '@normkompass/corpus';
import { describe, expect, it } from 'vitest';
import { chunkUnit, embeddingInput, splitText } from './chunking.js';

const unit = (text: string): CorpusUnit => ({
  id: 'ustg_1980/§ 14/Abs. 1',
  source: 'UStG',
  documentId: 'ustg_1980',
  path: ['§ 14', 'Abs. 1'],
  label: '§ 14 Abs. 1 UStG',
  title: 'Ausstellung von Rechnungen',
  url: 'https://example.test/14',
  stand: 'Stand X',
  text,
  kind: 'absatz',
});

describe('splitText', () => {
  it('keeps short text in one part', () => {
    expect(splitText('kurz', 100)).toEqual(['kurz']);
  });

  it('splits at line boundaries and reproduces the text exactly', () => {
    const text = Array.from({ length: 40 }, (_, i) => `Zeile ${i} mit etwas Inhalt`).join('\n');
    const parts = splitText(text, 200);
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.join('')).toBe(text);
    for (const p of parts) expect(p.length).toBeLessThanOrEqual(200);
    expect(parts[0]!.endsWith('\n')).toBe(true);
  });

  it('falls back to word and hard boundaries', () => {
    const words = 'wort '.repeat(100).trim();
    expect(splitText(words, 50).join('')).toBe(words);
    const solid = 'x'.repeat(130);
    const parts = splitText(solid, 50);
    expect(parts.map((p) => p.length)).toEqual([50, 50, 30]);
    expect(parts.join('')).toBe(solid);
  });
});

describe('chunkUnit', () => {
  it('numbers parts of a long unit and keeps the unit path', () => {
    const text = 'a\n'.repeat(500);
    const chunks = chunkUnit(unit(text), 100);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.map((c) => c.part)).toEqual(chunks.map((_, i) => i + 1));
    expect(
      chunks.every((c) => c.parts === chunks.length && c.unitId === 'ustg_1980/§ 14/Abs. 1'),
    ).toBe(true);
    expect(chunks.map((c) => c.text).join('')).toBe(text);
    expect(new Set(chunks.map((c) => c.id)).size).toBe(chunks.length);
  });

  it('changes the content hash when text or metadata changes', () => {
    const a = chunkUnit(unit('Text'))[0]!;
    expect(chunkUnit(unit('Text'))[0]!.contentHash).toBe(a.contentHash);
    expect(chunkUnit(unit('Anderer Text'))[0]!.contentHash).not.toBe(a.contentHash);
    expect(chunkUnit({ ...unit('Text'), stand: 'Stand Y' })[0]!.contentHash).not.toBe(
      a.contentHash,
    );
  });

  it('puts label and title before the text in the embedding input only', () => {
    const chunk = chunkUnit(unit('(1) Rechnung ist jedes Dokument'))[0]!;
    expect(embeddingInput(chunk)).toBe(
      '§ 14 Abs. 1 UStG Ausstellung von Rechnungen\n(1) Rechnung ist jedes Dokument',
    );
    expect(chunk.text).toBe('(1) Rechnung ist jedes Dokument');
  });
});
