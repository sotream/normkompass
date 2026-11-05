import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const readme = await readFile(
  fileURLToPath(new URL('../../../README.md', import.meta.url)),
  'utf-8',
);

/** GitHub's anchor for a heading: lowercase, punctuation removed, spaces turned into hyphens. */
const slug = (heading: string): string =>
  heading
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s/g, '-');

const lines = readme.split('\n');
let inFence = false;
const headings: string[] = [];
for (const line of lines) {
  if (line.startsWith('```')) inFence = !inFence;
  const m = /^## (.+)$/.exec(line);
  if (!inFence && m?.[1]) headings.push(m[1]);
}

const contentsStart = lines.indexOf('## Contents');
const next = lines.findIndex((l, i) => i > contentsStart && l.startsWith('## '));
const contents = lines.slice(contentsStart, next === -1 ? undefined : next).join('\n');
const links = [...contents.matchAll(/\]\(#([^)]+)\)/g)].map((m) => m[1] ?? '');

describe('README table of contents', () => {
  it('exists near the top', () => {
    expect(contentsStart).toBeGreaterThan(-1);
    expect(contentsStart).toBeLessThan(40);
  });

  it('links every second-level section except itself', () => {
    const expected = headings.filter((h) => h !== 'Contents').map(slug);
    for (const anchor of expected) expect(links, `missing entry for #${anchor}`).toContain(anchor);
  });

  it('has no link that points to no section', () => {
    const anchors = new Set(headings.map(slug));
    for (const link of links) expect(anchors.has(link), `no section for #${link}`).toBe(true);
  });

  it('lists each section once', () => {
    expect(new Set(links).size).toBe(links.length);
  });
});
