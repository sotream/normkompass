import type { CorpusUnit, SplitResult } from './types.js';
import { emptyReport } from './types.js';
import {
  attrOf,
  childrenOf,
  findChild,
  findChildren,
  parseXml,
  tagOf,
  toPlainText,
  type XmlNode,
} from './xml-text.js';

export const GII_BASE_URL = 'https://www.gesetze-im-internet.de';

export interface ParseStatuteOptions {
  /** Site slug of the law, e.g. "ustg_1980"; used for ids and URLs. */
  slug: string;
}

const PARAGRAPH = /^§\s*(\d+\s?[a-z]{0,2})$/;
const ABSATZ_MARKER = /^\((\d+[a-z]{0,2})\)\s/;

function textOf(node: XmlNode | undefined): string {
  return node ? toPlainText(childrenOf(node)) : '';
}

const isRepealedText = (text: string): boolean => /^\(weggefallen\)$/.test(text);

function normUrl(slug: string, enbez: string): string {
  const base = `${GII_BASE_URL}/${slug}`;
  const p = PARAGRAPH.exec(enbez);
  if (p?.[1]) return `${base}/__${p[1].replace(/\s/g, '')}.html`;
  const a = /^(Anlage|Art)\s*(\d+[a-z]*)?$/.exec(enbez);
  if (a) return `${base}/${a[1] === 'Art' ? 'art' : 'anlage'}${a[2] ? `_${a[2]}` : ''}.html`;
  return `${base}/index.html`;
}

interface AbsatzDraft {
  number: string | null;
  nodes: XmlNode[];
}

/** Splits the paragraphs of a norm at "(1)", "(2)", ... markers. */
function splitAbsaetze(paragraphs: XmlNode[]): AbsatzDraft[] {
  const drafts: AbsatzDraft[] = [];
  for (const p of paragraphs) {
    const marker = ABSATZ_MARKER.exec(toPlainText([p]) + ' ');
    if (marker?.[1]) drafts.push({ number: marker[1], nodes: [p] });
    else if (drafts.length === 0) drafts.push({ number: null, nodes: [p] });
    else drafts[drafts.length - 1]?.nodes.push(p);
  }
  return drafts;
}

interface NummerDraft {
  number: string;
  text: string;
}

/** Items of arabic-numbered lists that are direct children of the Absatz paragraphs. */
function nummern(nodes: XmlNode[]): NummerDraft[] {
  const out: NummerDraft[] = [];
  for (const p of nodes) {
    for (const dl of findChildren(p, 'DL')) {
      if (attrOf(dl, 'Type') !== 'arabic') continue;
      let term = '';
      for (const child of childrenOf(dl)) {
        const tag = tagOf(child);
        if (tag === 'DT') term = textOf(child);
        else if (tag === 'DD') {
          const number = /^(\d+[a-z]{0,2})\.$/.exec(term)?.[1];
          if (number) out.push({ number, text: `${term} ${textOf(child)}` });
          term = '';
        }
      }
    }
  }
  return out;
}

/** Parses one law file (gesetze-im-internet.de XML) into citation units. */
export function parseStatute(raw: string, options: ParseStatuteOptions): SplitResult {
  const { slug } = options;
  const report = emptyReport();
  const doc = parseXml(raw).find((n) => tagOf(n) === 'dokumente');
  const norms = doc ? findChildren(doc, 'norm') : [];
  if (norms.length === 0) {
    report.warnings.push('no <norm> elements found');
    return { source: slug, units: [], report };
  }

  const header = norms.find((n) => findChild(findChild(n, 'metadaten') ?? {}, 'langue'));
  const meta = header ? findChild(header, 'metadaten') : undefined;
  const source =
    textOf(meta && findChild(meta, 'amtabk')) || textOf(meta && findChild(meta, 'jurabk')) || slug;

  const standParts = (meta ? findChildren(meta, 'standangabe') : [])
    .filter((s) => textOf(findChild(s, 'standtyp')) === 'Stand')
    .map((s) => textOf(findChild(s, 'standkommentar')))
    .filter((s) => s.length > 0);
  const stand = standParts.length > 0 ? standParts.join('; ') : undefined;
  if (stand) report.stand = stand;
  else report.warnings.push('no Stand statement found');

  const units: CorpusUnit[] = [];
  const add = (
    path: string[],
    kind: CorpusUnit['kind'],
    title: string,
    url: string,
    text: string,
  ): void => {
    units.push({
      id: `${slug}/${path.join('/')}`,
      source,
      documentId: slug,
      path,
      label: `${path.join(' ')} ${source}`,
      title,
      url,
      ...(stand ? { stand } : {}),
      text,
      kind,
    });
  };

  const addNummern = (nodes: XmlNode[], parent: string[], title: string, url: string): void => {
    const items = nummern(nodes);
    const counts = new Map<string, number>();
    for (const i of items) counts.set(i.number, (counts.get(i.number) ?? 0) + 1);
    for (const item of items) {
      const repealed = isRepealedText(item.text.replace(/^\S+\s/, ''));
      if ((counts.get(item.number) ?? 0) > 1 || repealed) {
        report.skippedParts++;
        continue;
      }
      add([...parent, `Nr. ${item.number}`], 'nummer', title, url, item.text);
    }
  };

  for (const norm of norms) {
    if (norm === header) continue;
    const metaNode = findChild(norm, 'metadaten');
    if (!metaNode) continue;
    const enbez = textOf(findChild(metaNode, 'enbez'));
    const title = textOf(findChild(metaNode, 'titel'));
    const textNode = findChild(findChild(norm, 'textdaten') ?? {}, 'text');
    const content = textNode ? findChild(textNode, 'Content') : undefined;
    const body = content ? childrenOf(content) : [];
    const bodyText = toPlainText(body);

    if (findChild(metaNode, 'gliederungseinheit') || enbez === 'Inhaltsübersicht') {
      report.skippedStructural++;
      continue;
    }
    if (title === '(weggefallen)' || /^\(XXXX\)/.test(enbez) || isRepealedText(bodyText)) {
      report.skippedRepealed++;
      continue;
    }
    if (bodyText === '' || bodyText === '-') {
      report.skippedEmpty++;
      continue;
    }

    const url = normUrl(slug, enbez);
    const paragraph = PARAGRAPH.exec(enbez);

    if (!paragraph) {
      const label = enbez || title || 'Unbenannt';
      if (!/^(Anlage|Art)\b/.test(enbez)) report.unknownShapes.push(label);
      add([label], 'norm', title, url, bodyText);
      continue;
    }

    const base = [`§ ${(paragraph[1] ?? '').replace(/\s/g, '')}`];
    const drafts = splitAbsaetze(body.filter((n) => tagOf(n) === 'P'));

    if (!drafts.some((d) => d.number !== null)) {
      add(base, 'norm', title, url, bodyText);
      addNummern(
        drafts.flatMap((d) => d.nodes),
        base,
        title,
        url,
      );
      continue;
    }
    for (const d of drafts) {
      const text = toPlainText(d.nodes);
      if (text === '' || isRepealedText(text.replace(ABSATZ_MARKER, ''))) {
        report.skippedParts++;
        continue;
      }
      const path = d.number ? [...base, `Abs. ${d.number}`] : base;
      add(path, d.number ? 'absatz' : 'norm', title, url, text);
      addNummern(d.nodes, path, title, url);
    }
  }

  return { source, units, report };
}
