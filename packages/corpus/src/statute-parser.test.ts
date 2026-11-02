import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseStatute } from './statute-parser.js';
import type { CorpusUnit } from './types.js';

const fixture = (slug: string): string =>
  readFileSync(join(import.meta.dirname, '../test/fixtures/statutes', `${slug}.xml`), 'utf-8');

const parse = (slug: string) => parseStatute(fixture(slug), { slug });
const byId = (units: CorpusUnit[], id: string) => units.find((u) => u.id === id);

describe('statute parser on real XML excerpts', () => {
  const ustg = parse('ustg_1980');

  it('splits a § into one unit per Absatz with path, label, URL and Stand', () => {
    const u = byId(ustg.units, 'ustg_1980/§ 14/Abs. 1');
    expect(u).toMatchObject({
      source: 'UStG',
      path: ['§ 14', 'Abs. 1'],
      label: '§ 14 Abs. 1 UStG',
      title: 'Ausstellung von Rechnungen',
      url: 'https://www.gesetze-im-internet.de/ustg_1980/__14.html',
      kind: 'absatz',
    });
    expect(u?.stand).toBe('zuletzt geändert durch Art. 5 G v. 29.6.2026 I Nr. 197');
    expect(u?.text.startsWith('(1) Rechnung ist jedes Dokument')).toBe(true);
  });

  it('keeps Absatz suffixes such as 1a', () => {
    expect(byId(ustg.units, 'ustg_1980/§ 1/Abs. 1a')?.label).toBe('§ 1 Abs. 1a UStG');
  });

  it('makes Nummer units while the Absatz keeps the full list', () => {
    const abs = byId(ustg.units, 'ustg_1980/§ 14/Abs. 2');
    const nr = byId(ustg.units, 'ustg_1980/§ 14/Abs. 2/Nr. 1');
    expect(nr?.label).toBe('§ 14 Abs. 2 Nr. 1 UStG');
    expect(nr?.kind).toBe('nummer');
    expect(nr?.text.startsWith('1. für eine Leistung an einen anderen Unternehmer')).toBe(true);
    expect(abs?.text).toContain(nr?.text.replace(/\s+/g, ' ').slice(0, 60));
    expect(abs?.text).toMatch(/\n2\. für eine Leistung/);
  });

  it('skips repealed Nummer items instead of emitting units', () => {
    expect(byId(ustg.units, 'ustg_1980/§ 1/Abs. 1/Nr. 2')).toBeUndefined();
    expect(byId(ustg.units, 'ustg_1980/§ 1/Abs. 1/Nr. 4')).toBeDefined();
    expect(ustg.report.skippedParts).toBeGreaterThan(0);
  });

  it('skips repealed norms and structural norms and counts them', () => {
    expect(ustg.units.some((u) => u.path[0] === '§ 13d')).toBe(false);
    expect(ustg.report.skippedRepealed).toBe(2); // § 13d, Anlage 1
    expect(ustg.report.skippedStructural).toBe(2); // Gliederung heading, Inhaltsübersicht
  });

  it('turns an Anlage with a table into one unit with readable rows', () => {
    const u = byId(ustg.units, 'ustg_1980/Anlage 4');
    expect(u).toMatchObject({
      kind: 'norm',
      url: 'https://www.gesetze-im-internet.de/ustg_1980/anlage_4.html',
    });
    expect(u?.text).toContain(' | ');
    expect(ustg.report.unknownShapes).toEqual([]);
  });

  it('keeps unit ids unique', () => {
    const ids = ustg.units.map((u) => u.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('law-specific shapes', () => {
  it('makes one unit for a § without Absätze and Nummer units for its list', () => {
    const { units } = parse('ustdv_1980');
    expect(byId(units, 'ustdv_1980/§ 2')).toMatchObject({ kind: 'norm', label: '§ 2 UStDV' });
    expect(byId(units, 'ustdv_1980/§ 33')).toBeDefined();
    expect(byId(units, 'ustdv_1980/§ 33/Nr. 1')?.label).toBe('§ 33 Nr. 1 UStDV');
  });

  it('skips "(XXXX) §§ ..." range placeholders and repealed numbered norms', () => {
    const { units, report } = parse('ustdv_1980');
    expect(units.some((u) => u.path[0]?.startsWith('(XXXX)'))).toBe(false);
    expect(units.some((u) => u.path[0] === '§ 50')).toBe(false);
    expect(report.skippedRepealed).toBeGreaterThanOrEqual(2);
  });

  it.each([
    ['ao_1977', 'AO', 'zuletzt geändert durch Art. 6 G v. 22.10.2026 I Nr. 320'],
    ['bdsg_2018', 'BDSG', 'Zuletzt geändert durch Art. 3 G v. 12.5.2026 I Nr. 139'],
    ['ddg', 'DDG', 'Zuletzt geändert durch Art. 26 Abs. 2 G v. 25.3.2026 I Nr. 81'],
  ])('parses %s with source name and Stand on every unit', (slug, source, stand) => {
    const { units, report } = parse(slug);
    expect(units.length).toBeGreaterThan(5);
    expect(report.stand).toBe(stand);
    for (const u of units) {
      expect(u.source).toBe(source);
      expect(u.stand).toBe(stand);
      expect(u.url).toContain(`/${slug}/`);
      expect(u.text.length).toBeGreaterThan(0);
    }
  });

  it('numbers AO Nummer items with letter suffixes', () => {
    expect(byId(parse('ao_1977').units, 'ao_1977/§ 3/Abs. 4/Nr. 3a')).toBeDefined();
  });
});

describe('degraded input', () => {
  const wrap = (norms: string): string => `<?xml version="1.0"?><dokumente>${norms}</dokumente>`;
  const header = (stand: string): string =>
    `<norm><metadaten><jurabk>XG</jurabk><amtabk>XG</amtabk><langue>Testgesetz</langue>${stand}</metadaten><textdaten/></norm>`;

  it('still produces units and reports a missing Stand', () => {
    const xml = wrap(
      header('') +
        '<norm><metadaten><enbez>§ 1</enbez><titel>T</titel></metadaten><textdaten><text><Content><P>Text.</P></Content></text></textdaten></norm>',
    );
    const { units, report } = parseStatute(xml, { slug: 'xg' });
    expect(units).toHaveLength(1);
    expect(units[0]?.stand).toBeUndefined();
    expect(report.stand).toBeUndefined();
    expect(report.warnings).toContain('no Stand statement found');
  });

  it('turns a norm without recognizable § number into one unit and reports it', () => {
    const xml = wrap(
      header('') +
        '<norm><metadaten><enbez>Schlussformel</enbez></metadaten><textdaten><text><Content><P>Ende.</P></Content></text></textdaten></norm>',
    );
    const { units, report } = parseStatute(xml, { slug: 'xg' });
    expect(units.map((u) => u.path)).toEqual([['Schlussformel']]);
    expect(report.unknownShapes).toEqual(['Schlussformel']);
  });

  it('drops Nummer items whose number is ambiguous inside one Absatz', () => {
    const list = (t: string): string => `<DL Type="arabic"><DT>1.</DT><DD><LA>${t}</LA></DD></DL>`;
    const xml = wrap(
      header('') +
        `<norm><metadaten><enbez>§ 2</enbez><titel>T</titel></metadaten><textdaten><text><Content><P>(1) Satz: ${list('a')} Weiter: ${list('b')}</P></Content></text></textdaten></norm>`,
    );
    const { units, report } = parseStatute(xml, { slug: 'xg' });
    expect(units.map((u) => u.id)).toEqual(['xg/§ 2/Abs. 1']);
    expect(report.skippedParts).toBe(2);
  });

  it('reports a file without norms', () => {
    const { units, report } = parseStatute('<dokumente/>', { slug: 'xg' });
    expect(units).toEqual([]);
    expect(report.warnings).toContain('no <norm> elements found');
  });
});
