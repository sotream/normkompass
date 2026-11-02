import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { unzipSync, strFromU8 } from 'fflate';
import { GII_BASE_URL, parseStatute } from './statute-parser.js';
import type { CorpusDocument, CorpusSource, SplitResult } from './types.js';

export interface LawSpec {
  /** Site slug, e.g. "ustg_1980". */
  slug: string;
  title: string;
}

/** Demo corpus: German federal laws; slugs checked against gii-toc.xml. */
export const DEMO_LAWS: readonly LawSpec[] = [
  { slug: 'ustg_1980', title: 'Umsatzsteuergesetz' },
  { slug: 'ustdv_1980', title: 'Umsatzsteuer-Durchführungsverordnung' },
  { slug: 'ao_1977', title: 'Abgabenordnung' },
  { slug: 'bdsg_2018', title: 'Bundesdatenschutzgesetz' },
  { slug: 'ddg', title: 'Digitale-Dienste-Gesetz' },
];

export const USER_AGENT = 'normkompass/0.0 (+https://github.com/sotream/normkompass)';

export interface GiiSourceOptions {
  /** Directory for raw downloads; must be git-ignored. */
  cacheDir: string;
  laws?: readonly LawSpec[];
  /** Pause between two network requests. */
  pauseMs?: number;
  /** Download again even if a cached file exists. */
  refresh?: boolean;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}

const exists = (path: string): Promise<boolean> =>
  access(path).then(
    () => true,
    () => false,
  );

/** Federal laws from gesetze-im-internet.de, fetched one at a time and cached on disk. */
export class GesetzeImInternetSource implements CorpusSource {
  readonly name = 'gesetze-im-internet';
  private readonly laws: readonly LawSpec[];
  private readonly pauseMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(private readonly options: GiiSourceOptions) {
    this.laws = options.laws ?? DEMO_LAWS;
    this.pauseMs = options.pauseMs ?? 2000;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.sleep = options.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  }

  async *loadDocuments(): AsyncIterable<CorpusDocument> {
    await mkdir(this.options.cacheDir, { recursive: true });
    let requested = false;
    for (const law of this.laws) {
      const file = join(this.options.cacheDir, `${law.slug}.xml`);
      let raw: string;
      if (!this.options.refresh && (await exists(file))) {
        raw = await readFile(file, 'utf-8');
      } else {
        if (requested) await this.sleep(this.pauseMs);
        requested = true;
        raw = await this.download(law.slug);
        await writeFile(file, raw, 'utf-8');
      }
      yield { id: law.slug, title: law.title, url: `${GII_BASE_URL}/${law.slug}/index.html`, raw };
    }
  }

  split(document: CorpusDocument): SplitResult {
    return parseStatute(document.raw, { slug: document.id });
  }

  private async download(slug: string): Promise<string> {
    const url = `${GII_BASE_URL}/${slug}/xml.zip`;
    const res = await this.fetchImpl(url, { headers: { 'User-Agent': USER_AGENT } });
    if (!res.ok) throw new Error(`GET ${url} failed with status ${res.status}`);
    const files = unzipSync(new Uint8Array(await res.arrayBuffer()));
    const name = Object.keys(files).find((n) => n.endsWith('.xml'));
    const data = name ? files[name] : undefined;
    if (!data) throw new Error(`${url} contains no XML file`);
    return strFromU8(data);
  }
}
