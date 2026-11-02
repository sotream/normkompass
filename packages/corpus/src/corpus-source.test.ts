import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MarkdownFolderSource } from '../test/markdown-source.js';
import { parseStatute } from './statute-parser.js';
import type { CorpusSource, CorpusUnit } from './types.js';
import { readFileSync } from 'node:fs';

async function unitsOf(source: CorpusSource): Promise<CorpusUnit[]> {
  const out: CorpusUnit[] = [];
  for await (const doc of source.loadDocuments()) out.push(...source.split(doc).units);
  return out;
}

describe('CorpusSource interface', () => {
  const markdown = new MarkdownFolderSource(join(import.meta.dirname, '../test/fixtures/markdown'));

  it('yields units of the same shape from a markdown source', async () => {
    const units = await unitsOf(markdown);
    const u = units.find((x) => x.path.join('/') === 'Handbuch/Urlaub/Übertragung');
    expect(u).toMatchObject({
      source: 'handbuch',
      title: 'Übertragung',
      text: 'Resturlaub verfällt zum 31. März des Folgejahres.',
    });
    expect(u?.stand).toBeUndefined();
    expect(u?.url).toBeTruthy();
    expect(u?.label).toBeTruthy();
  });

  it('skips headings without text', async () => {
    const units = await unitsOf(markdown);
    expect(units.some((u) => u.documentId === 'leer')).toBe(false);
  });

  it('shares one unit shape with the statute parser', async () => {
    const mdUnit = (await unitsOf(markdown))[0]!;
    const xml = readFileSync(
      join(import.meta.dirname, '../test/fixtures/statutes/ddg.xml'),
      'utf-8',
    );
    const lawUnit = parseStatute(xml, { slug: 'ddg' }).units[0]!;
    const shape = (u: CorpusUnit) =>
      Object.keys(u)
        .filter((k) => k !== 'stand')
        .sort();
    expect(shape(mdUnit)).toEqual(shape(lawUnit));
  });
});
