import { XMLParser } from 'fast-xml-parser';

/** A node of the order-preserving parse tree. */
export type XmlNode = Record<string, unknown>;

const parser = new XMLParser({
  preserveOrder: true,
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  trimValues: false,
  parseTagValue: false,
  parseAttributeValue: false,
  processEntities: true,
});

export function parseXml(raw: string): XmlNode[] {
  return parser.parse(raw) as XmlNode[];
}

export function tagOf(node: XmlNode): string | undefined {
  return Object.keys(node).find((k) => k !== ':@' && k !== '#text');
}

export function childrenOf(node: XmlNode): XmlNode[] {
  const tag = tagOf(node);
  if (!tag) return [];
  const value = node[tag];
  return Array.isArray(value) ? (value as XmlNode[]) : [];
}

export function attrOf(node: XmlNode, name: string): string | undefined {
  const attrs = node[':@'] as Record<string, string> | undefined;
  return attrs?.[`@_${name}`];
}

export function findChildren(node: XmlNode, tag: string): XmlNode[] {
  return childrenOf(node).filter((c) => tagOf(c) === tag);
}

export function findChild(node: XmlNode, tag: string): XmlNode | undefined {
  return findChildren(node, tag)[0];
}

function isTextNode(node: XmlNode): boolean {
  return '#text' in node;
}

const collapse = (s: string): string => s.replace(/\s+/g, ' ');

/** Inline content: text and inline elements, no block structure. */
function inline(nodes: XmlNode[]): string {
  let out = '';
  for (const node of nodes) {
    if (isTextNode(node)) {
      out += collapse(String(node['#text']));
      continue;
    }
    const tag = tagOf(node);
    if (tag === 'BR') out += '\n';
    else if (tag === 'pre') out += preText(childrenOf(node));
    else if (tag === 'DL') out += list(node);
    else if (tag === 'table') out += table(node);
    else out += inline(childrenOf(node));
  }
  return out;
}

function preText(nodes: XmlNode[]): string {
  let out = '';
  for (const node of nodes) {
    if (isTextNode(node)) out += String(node['#text']);
    else if (tagOf(node) === 'BR') out += '\n';
    else out += preText(childrenOf(node));
  }
  return out;
}

/** Definition list: each item on its own line as "<number> <text>". */
function list(dl: XmlNode): string {
  let out = '';
  let term = '';
  for (const child of childrenOf(dl)) {
    const tag = tagOf(child);
    if (tag === 'DT') term = inline(childrenOf(child)).trim();
    else if (tag === 'DD') {
      out += `\n${term} ${inline(childrenOf(child)).trim()}`;
      term = '';
    }
  }
  return out;
}

/** Table: each row on its own line, cells separated by " | ". */
function table(node: XmlNode): string {
  const rows: string[] = [];
  const walk = (n: XmlNode): void => {
    if (tagOf(n) === 'row') {
      const cells = findChildren(n, 'entry')
        .map((e) => inline(childrenOf(e)).trim())
        .filter((c) => c.length > 0);
      if (cells.length > 0) rows.push(cells.join(' | '));
      return;
    }
    childrenOf(n).forEach(walk);
  };
  walk(node);
  return rows.length > 0 ? `\n${rows.join('\n')}\n` : '';
}

/** Converts parsed XML content into plain text; list numbering and sentence order are kept. */
export function toPlainText(nodes: XmlNode[]): string {
  return inline(nodes)
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
