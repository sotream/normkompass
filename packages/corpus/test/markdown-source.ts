import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { CorpusDocument, CorpusSource, CorpusUnit, SplitResult } from '../src/index.js';
import { emptyReport } from '../src/index.js';

/**
 * Test-fixture implementation of CorpusSource: one document per .md file,
 * one unit per heading section. It exists to show that the interface is not law-specific.
 */
export class MarkdownFolderSource implements CorpusSource {
  readonly name = 'markdown-folder';

  constructor(private readonly dir: string) {}

  async *loadDocuments(): AsyncIterable<CorpusDocument> {
    const files = (await readdir(this.dir)).filter((f) => f.endsWith('.md')).sort();
    for (const file of files) {
      const id = file.replace(/\.md$/, '');
      const raw = await readFile(join(this.dir, file), 'utf-8');
      yield { id, title: id, url: `file:${file}`, raw };
    }
  }

  split(document: CorpusDocument): SplitResult {
    const units: CorpusUnit[] = [];
    const stack: string[] = [];
    let current: { path: string[]; title: string; lines: string[] } | undefined;
    const flush = (): void => {
      const text = current?.lines.join('\n').trim();
      if (current && text) {
        units.push({
          id: `${document.id}/${current.path.join('/')}`,
          source: document.id,
          documentId: document.id,
          path: current.path,
          label: `${current.path.join(' > ')} (${document.id})`,
          title: current.title,
          url: document.url,
          text,
          kind: 'norm',
        });
      }
    };
    for (const line of document.raw.split('\n')) {
      const heading = /^(#{1,6})\s+(.*)$/.exec(line);
      if (heading?.[1] && heading[2]) {
        flush();
        stack.length = heading[1].length - 1;
        stack[heading[1].length - 1] = heading[2].trim();
        current = { path: [...stack], title: heading[2].trim(), lines: [] };
      } else current?.lines.push(line);
    }
    flush();
    return { source: document.id, units, report: emptyReport() };
  }
}
