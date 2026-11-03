import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  emptyReport,
  type CorpusDocument,
  type CorpusSource,
  type CorpusUnit,
  type SplitResult,
} from '@normkompass/corpus';

/**
 * Example corpus adapter: a folder of .txt files. Each file is one document; a line starting with "# "
 * begins a section, and every section is one citable unit (path = [section title]).
 *
 * To use your own documents, implement the same three members: `name`, `loadDocuments()` (read the raw
 * material) and `split()` (turn one document into units with a stable id, a path and a label).
 */
export class TextFolderSource implements CorpusSource {
  readonly name = 'text-folder';

  constructor(private readonly dir: string) {}

  async *loadDocuments(): AsyncIterable<CorpusDocument> {
    const files = (await readdir(this.dir)).filter((f) => f.endsWith('.txt')).sort();
    for (const file of files) {
      const id = file.replace(/\.txt$/, '');
      yield {
        id,
        title: id,
        url: `file:${file}`,
        raw: await readFile(join(this.dir, file), 'utf-8'),
      };
    }
  }

  split(document: CorpusDocument): SplitResult {
    const units: CorpusUnit[] = [];
    let title: string | undefined;
    let lines: string[] = [];
    const flush = (): void => {
      const text = lines.join('\n').trim();
      if (title && text) {
        units.push({
          id: `${document.id}/${title}`,
          source: document.id,
          documentId: document.id,
          path: [title],
          label: `${title} (${document.id})`,
          title,
          url: document.url,
          text,
          kind: 'norm',
        });
      }
    };
    for (const line of document.raw.split('\n')) {
      const heading = /^#\s+(.+)$/.exec(line);
      if (heading?.[1]) {
        flush();
        title = heading[1].trim();
        lines = [];
      } else {
        lines.push(line);
      }
    }
    flush();
    return { source: document.id, units, report: emptyReport() };
  }
}
