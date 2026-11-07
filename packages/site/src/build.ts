import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { checkSite, renderSite, type SourcePage } from './render.js';

export const REPOSITORY = 'sotream/normkompass';

/** The Markdown files that become pages, and the output path of each. */
export function sourcePages(root: string): SourcePage[] {
  const read = (path: string): string => readFileSync(join(root, path), 'utf-8');
  const pages: SourcePage[] = [
    { source: 'README.md', output: 'index.html', markdown: read('README.md') },
    {
      source: 'docs/worked-example.md',
      output: 'worked-example.html',
      markdown: read('docs/worked-example.md'),
    },
  ];
  for (const name of readdirSync(join(root, 'docs', 'adr')).sort()) {
    if (!name.endsWith('.md')) continue;
    pages.push({
      source: `docs/adr/${name}`,
      output: name === 'README.md' ? 'adr/index.html' : `adr/${name.replace(/\.md$/, '.html')}`,
      markdown: read(`docs/adr/${name}`),
    });
  }
  return pages;
}

export function chartAssets(root: string): Map<string, string> {
  const dir = join(root, 'docs', 'charts');
  const assets = new Map<string, string>();
  if (existsSync(dir)) {
    for (const name of readdirSync(dir).sort()) {
      if (name.endsWith('.svg')) assets.set(`docs/charts/${name}`, `charts/${name}`);
    }
  }
  return assets;
}

export function currentCommit(root: string): string {
  const fromEnv = process.env.GITHUB_SHA;
  if (fromEnv) return fromEnv;
  return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf-8' }).trim();
}

/** Builds the site into `out`; returns the problems found, and writes nothing when there are any. */
export async function buildSite(root: string, out: string, commit: string): Promise<string[]> {
  const assets = chartAssets(root);
  const { files, errors } = renderSite(sourcePages(root), {
    repository: REPOSITORY,
    commit,
    assets,
    kind: (path) => {
      const full = join(root, path);
      if (!existsSync(full)) return undefined;
      return statSync(full).isDirectory() ? 'directory' : 'file';
    },
  });
  const all = new Map<string, string | Uint8Array>(files);
  for (const [source, target] of assets) all.set(target, readFileSync(join(root, source)));
  errors.push(...checkSite(all));
  if (errors.length > 0) return errors;
  await rm(out, { recursive: true, force: true });
  for (const [path, content] of all) {
    const file = join(out, path);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, content);
  }
  await writeFile(join(out, '.nojekyll'), '');
  return [];
}
