import { mkdtemp, readFile, readdir, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildSite } from './build.js';
import {
  addHeadingIds,
  checkSite,
  renderSite,
  slug,
  type SiteContext,
  type SourcePage,
} from './render.js';

const root = join(import.meta.dirname, '../../..');

const context = (extra: Partial<SiteContext> = {}): SiteContext => ({
  repository: 'owner/repo',
  commit: 'abcdef1234567890',
  kind: (path) =>
    path === 'eval'
      ? 'directory'
      : ['LICENSE', 'eval/results/a.json'].includes(path)
        ? 'file'
        : undefined,
  assets: new Map([['docs/charts/c.svg', 'charts/c.svg']]),
  ...extra,
});

const page = (source: string, output: string, markdown: string): SourcePage => ({
  source,
  output,
  markdown,
});

describe('slug and heading ids', () => {
  it('follows the GitHub rule, as the README contents test does', () => {
    expect(slug('Results: other models (not Claude)')).toBe('results-other-models-not-claude');
    expect(slug('How this was built')).toBe('how-this-was-built');
  });

  it('numbers a repeated heading and adds ids to headings with attributes', () => {
    const html = addHeadingIds('<h1 align="center">Name</h1><h2>Same</h2><h2>Same</h2>');
    expect(html).toContain('<h1 align="center" id="name">');
    expect(html).toContain('<h2 id="same">Same</h2>');
    expect(html).toContain('<h2 id="same-1">Same</h2>');
  });
});

describe('renderSite', () => {
  const pages = [
    page(
      'README.md',
      'index.html',
      [
        '# Title',
        '',
        '## Section',
        '',
        'See [the decision](docs/adr/0001-x.md#why), [the license](LICENSE), [results](eval/results/a.json),',
        '[a folder](eval/), [the section](#section) and [outside](https://example.org/x).',
        '',
        '![chart](docs/charts/c.svg)',
        '',
        '```mermaid',
        'flowchart LR',
        '  a --> b',
        '```',
        '',
      ].join('\n'),
    ),
    page(
      'docs/adr/0001-x.md',
      'adr/0001-x.html',
      '# ADR\n\n## Why\n\nBack to [home](../../README.md).\n',
    ),
  ];

  it('rewrites links to pages and charts and sends other files to GitHub at the commit', () => {
    const { files, errors } = renderSite(pages, context());
    expect(errors).toEqual([]);
    const home = files.get('index.html') ?? '';
    expect(home).toContain('href="adr/0001-x.html#why"');
    expect(home).toContain('href="https://github.com/owner/repo/blob/abcdef1234567890/LICENSE"');
    expect(home).toContain(
      'href="https://github.com/owner/repo/blob/abcdef1234567890/eval/results/a.json"',
    );
    expect(home).toContain('href="https://github.com/owner/repo/tree/abcdef1234567890/eval"');
    expect(home).toContain('src="charts/c.svg"');
    expect(home).toContain('href="#section"');
    expect(home).toContain('href="https://example.org/x"');
    expect(files.get('adr/0001-x.html')).toContain('href="../index.html"');
  });

  it('keeps the diagram source as readable text and loads the pinned library only there', () => {
    const { files } = renderSite(pages, context());
    const home = files.get('index.html') ?? '';
    expect(home).toContain('<pre class="mermaid">flowchart LR\n  a --&gt; b</pre>');
    expect(home).toContain('mermaid@11.4.1');
    expect(files.get('adr/0001-x.html')).not.toContain('mermaid@');
  });

  it('adds navigation and a footer with the commit and the legal notice, and no analytics', () => {
    const { files } = renderSite(pages, context());
    const adr = files.get('adr/0001-x.html') ?? '';
    expect(adr).toContain('href="../worked-example.html"');
    expect(adr).toContain('<code>abcdef1</code>');
    expect(adr).toContain('Not legal advice.');
    expect(adr).toContain('<title>ADR</title>');
    expect(adr.toLowerCase()).not.toMatch(/analytics|gtag|fonts\.googleapis|cookie/);
  });

  it('reports a link to a file that does not exist, naming the page and the target', () => {
    const broken = [page('README.md', 'index.html', '# T\n\n[gone](docs/missing.md)\n')];
    const { errors } = renderSite(broken, context());
    expect(errors).toEqual([
      'README.md: "docs/missing.md" does not resolve to a file in the repository',
    ]);
  });
});

describe('checkSite', () => {
  it('finds a missing target and a missing anchor', () => {
    const files = new Map<string, string | Uint8Array>([
      [
        'index.html',
        '<h1 id="t">T</h1><a href="a.html#nope">x</a><a href="gone.html">y</a><img src="charts/c.svg">',
      ],
      ['a.html', '<h1 id="a">A</h1>'],
    ]);
    expect(checkSite(files)).toEqual([
      'index.html: "a.html#nope" has no heading "nope" in a.html',
      'index.html: "gone.html" points at gone.html, which is not in the site',
      'index.html: "charts/c.svg" points at charts/c.svg, which is not in the site',
    ]);
  });

  it('accepts a link to a chart that is in the site', () => {
    const files = new Map<string, string | Uint8Array>([
      ['index.html', '<a href="#t">x</a><h1 id="t">T</h1><img src="charts/c.svg">'],
      ['charts/c.svg', new Uint8Array([60])],
    ]);
    expect(checkSite(files)).toEqual([]);
  });
});

describe('the real site', () => {
  it('builds from this repository, with every page, chart and anchor resolving', async () => {
    const out = await mkdtemp(join(tmpdir(), 'site-'));
    try {
      const errors = await buildSite(root, out, 'abcdef1234567890');
      expect(errors).toEqual([]);
      const top = await readdir(out);
      expect(top).toEqual(
        expect.arrayContaining(['index.html', 'worked-example.html', 'adr', 'charts']),
      );
      expect((await readdir(join(out, 'adr'))).length).toBeGreaterThanOrEqual(6);
      expect((await readdir(join(out, 'charts'))).sort()).toEqual([
        'answer-evaluation.svg',
        'embedding-models.svg',
        'retrieval-lexical.svg',
        'retrieval-paraphrase.svg',
      ]);
      const home = await readFile(join(out, 'index.html'), 'utf-8');
      for (const heading of [
        'Honest limits',
        'How it works',
        'Retrieval results',
        'Related projects',
      ]) {
        expect(home, heading).toContain(heading);
      }
    } finally {
      await rm(out, { recursive: true, force: true });
    }
  });

  it('writes nothing when the site has a problem', async () => {
    const fake = await mkdtemp(join(tmpdir(), 'repo-'));
    const out = join(fake, 'site');
    try {
      await mkdir(join(fake, 'docs', 'adr'), { recursive: true });
      await writeFile(join(fake, 'README.md'), '# T\n\n[gone](nothing.md)\n');
      await writeFile(join(fake, 'docs', 'worked-example.md'), '# W\n');
      const errors = await buildSite(fake, out, 'abc');
      expect(errors.length).toBeGreaterThan(0);
      await expect(readdir(out)).rejects.toThrow();
    } finally {
      await rm(fake, { recursive: true, force: true });
    }
  });
});
