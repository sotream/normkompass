import { posix } from 'node:path';
import { Marked } from 'marked';

/** Where the site's text comes from and where it goes. */
export interface SourcePage {
  /** Repository path of the Markdown file, for example `docs/adr/0001-corpus-and-licensing.md`. */
  source: string;
  /** Path of the generated page inside the site, for example `adr/0001-corpus-and-licensing.html`. */
  output: string;
  markdown: string;
}

export interface SiteContext {
  /** `owner/name` of the repository, used for links to files the site does not contain. */
  repository: string;
  commit: string;
  /** What the path is in the repository, or undefined when it does not exist; a link to nothing fails the build. */
  kind: (path: string) => 'file' | 'directory' | undefined;
  /** Source paths of the site's other files (charts) and where they are copied to. */
  assets: Map<string, string>;
}

export const MERMAID_VERSION = '11.4.1';

const WRITTEN: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
};

const decode = (text: string): string =>
  text.replace(/&(?:amp|lt|gt|quot|#39);/g, (entity) => WRITTEN[entity] ?? entity);
const stripTags = (html: string): string => html.replace(/<[^>]*>/g, '');

export const escapeHtml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** GitHub's anchor for a heading: lower case, punctuation removed, spaces turned into hyphens. */
export const slug = (heading: string): string =>
  heading
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s/g, '-');

const external = (href: string): boolean =>
  /^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('//');

/** Adds an id to every heading, numbering repeated headings the way GitHub does. */
export function addHeadingIds(html: string): string {
  const seen = new Map<string, number>();
  return html.replace(
    /<h([1-6])([^>]*)>([\s\S]*?)<\/h\1>/g,
    (_whole, level: string, attrs: string, inner: string) => {
      const base = slug(decode(stripTags(inner)));
      const count = seen.get(base) ?? 0;
      seen.set(base, count + 1);
      const id = count === 0 ? base : `${base}-${count}`;
      return `<h${level}${attrs} id="${id}">${inner}</h${level}>`;
    },
  );
}

/**
 * Rewrites every relative link and image of a page: links to pages and charts of the site become relative
 * paths inside the site, links to other repository files become links to that file on GitHub, and a link to a
 * file that does not exist is an error.
 */
export function rewriteLinks(
  html: string,
  page: SourcePage,
  pages: Map<string, string>,
  context: SiteContext,
  errors: string[],
): string {
  return html.replace(/\b(href|src)="([^"]*)"/g, (whole, attr: string, value: string) => {
    const href = decode(value);
    if (href === '' || href.startsWith('#') || external(href)) return whole;
    const [pathPart = '', fragment] = href.split('#');
    const resolved = posix.normalize(posix.join(posix.dirname(page.source), pathPart));
    const tail = fragment === undefined ? '' : `#${fragment}`;
    const inSite = pages.get(resolved) ?? context.assets.get(resolved);
    if (inSite !== undefined) {
      const from = posix.dirname(page.output);
      return `${attr}="${posix.relative(from, inSite) || posix.basename(inSite)}${tail}"`;
    }
    const path = resolved.replace(/\/$/, '');
    const kind = context.kind(path);
    if (kind === undefined) {
      errors.push(`${page.source}: "${href}" does not resolve to a file in the repository`);
      return whole;
    }
    const view = kind === 'directory' ? 'tree' : 'blob';
    return `${attr}="https://github.com/${context.repository}/${view}/${context.commit}/${path}${tail}"`;
  });
}

/** Mermaid blocks keep their source as readable text; the page script draws them when it can. */
function markdown(): Marked {
  const marked = new Marked({ gfm: true });
  marked.use({
    renderer: {
      code({ text, lang }) {
        if (lang === 'mermaid') return `<pre class="mermaid">${escapeHtml(text)}</pre>\n`;
        const cls = lang ? ` class="language-${escapeHtml(lang)}"` : '';
        return `<pre><code${cls}>${escapeHtml(text)}</code></pre>\n`;
      },
    },
  });
  return marked;
}

const CSS = `
:root{color-scheme:light dark;--bg:#fff;--fg:#1f2328;--muted:#59636e;--line:#d1d9e0;--link:#0969da;--code:#f6f8fa}
@media (prefers-color-scheme:dark){:root{--bg:#0d1117;--fg:#e6edf3;--muted:#9198a1;--line:#3d444d;--link:#4493f8;--code:#161b22}}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.6 system-ui,sans-serif}
a{color:var(--link)}
nav{border-bottom:1px solid var(--line);padding:.6rem 1rem;display:flex;flex-wrap:wrap;gap:1rem}
nav a{text-decoration:none;font-weight:600}
main{max-width:56rem;margin:0 auto;padding:1rem}
footer{max-width:56rem;margin:2rem auto 1rem;padding:1rem;border-top:1px solid var(--line);color:var(--muted);font-size:.9rem}
img,svg{max-width:100%;height:auto}
pre{background:var(--code);padding:.8rem;overflow:auto;border-radius:6px}
code{background:var(--code);padding:.1rem .25rem;border-radius:4px}
pre code{padding:0;background:none}
table{border-collapse:collapse;display:block;overflow:auto}
th,td{border:1px solid var(--line);padding:.3rem .6rem}
details{margin:1rem 0}
h1,h2,h3{line-height:1.25}
`;

export function layout(title: string, body: string, depth: number, context: SiteContext): string {
  const root = depth === 0 ? '' : '../'.repeat(depth);
  const diagrams = body.includes('class="mermaid"');
  const script = diagrams
    ? `<script type="module">
import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@${MERMAID_VERSION}/dist/mermaid.esm.min.mjs';
const dark = matchMedia('(prefers-color-scheme: dark)').matches;
mermaid.initialize({ startOnLoad: false, theme: dark ? 'dark' : 'default' });
await mermaid.run({ querySelector: 'pre.mermaid' });
</script>`
    : '';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>${CSS}</style>
</head>
<body>
<nav>
<a href="${root}index.html">Home</a>
<a href="${root}worked-example.html">Worked example</a>
<a href="${root}adr/index.html">Decisions (ADR)</a>
<a href="https://github.com/${context.repository}">GitHub</a>
</nav>
<main>
${body}
</main>
<footer>Built from commit <a href="https://github.com/${context.repository}/commit/${context.commit}"><code>${escapeHtml(context.commit.slice(0, 7))}</code></a> of ${escapeHtml(context.repository)}. Not legal advice.</footer>
${script}
</body>
</html>
`;
}

/** Renders every page and returns the files of the site, keyed by output path, with the errors found. */
export function renderSite(
  sources: SourcePage[],
  context: SiteContext,
): { files: Map<string, string>; errors: string[] } {
  const errors: string[] = [];
  const pages = new Map(sources.map((p) => [p.source, p.output]));
  const files = new Map<string, string>();
  const marked = markdown();
  for (const page of sources) {
    const rendered = addHeadingIds(marked.parse(page.markdown, { async: false }));
    const body = rewriteLinks(rendered, page, pages, context, errors);
    const heading = /<h1[^>]*>([\s\S]*?)<\/h1>/.exec(body);
    const title = heading?.[1] ? decode(stripTags(heading[1])) : page.output;
    const depth = page.output.split('/').length - 1;
    files.set(page.output, layout(title, body, depth, context));
  }
  return { files, errors };
}

/** Checks the finished site: every relative link and image points at a file, and every anchor at a heading. */
export function checkSite(files: Map<string, string | Uint8Array>): string[] {
  const errors: string[] = [];
  const ids = new Map<string, Set<string>>();
  for (const [path, content] of files) {
    if (typeof content !== 'string' || !path.endsWith('.html')) continue;
    ids.set(path, new Set([...content.matchAll(/\bid="([^"]*)"/g)].map((m) => m[1] ?? '')));
  }
  for (const [path, content] of files) {
    if (typeof content !== 'string' || !path.endsWith('.html')) continue;
    for (const m of content.matchAll(/\b(?:href|src)="([^"]*)"/g)) {
      const href = decode(m[1] ?? '');
      if (href === '' || external(href)) continue;
      const [pathPart = '', fragment] = href.split('#');
      const target =
        pathPart === '' ? path : posix.normalize(posix.join(posix.dirname(path), pathPart));
      if (!files.has(target)) {
        errors.push(`${path}: "${href}" points at ${target}, which is not in the site`);
        continue;
      }
      if (fragment !== undefined && fragment !== '' && target.endsWith('.html')) {
        if (!ids.get(target)?.has(fragment)) {
          errors.push(`${path}: "${href}" has no heading "${fragment}" in ${target}`);
        }
      }
    }
  }
  return errors;
}
