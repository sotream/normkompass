import type { SearchHit } from '@normkompass/search';

/** Builds a search hit for tests. */
export function makeHit(over: Partial<SearchHit> & { text: string }): SearchHit {
  return {
    chunkId: 'ustg_1980/§ 14/Abs. 1#1',
    unitId: 'ustg_1980/§ 14/Abs. 1',
    part: 1,
    source: 'UStG',
    path: ['§ 14', 'Abs. 1'],
    label: '§ 14 Abs. 1 UStG',
    title: 'Ausstellung von Rechnungen',
    url: 'https://www.gesetze-im-internet.de/ustg_1980/__14.html',
    stand: 'zuletzt geändert durch Art. 5 G v. 29.6.2026 I Nr. 197',
    score: 0.03,
    vectorRank: 1,
    ftsRank: 1,
    ...over,
  };
}
