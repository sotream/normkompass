import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildCharts } from './chart-build.js';

const root = fileURLToPath(new URL('../../../', import.meta.url));

describe('committed charts', () => {
  it('match what the generator draws from the recorded results', async () => {
    const charts = await buildCharts(`${root}eval/results`);
    expect(Object.keys(charts).sort()).toEqual([
      'answer-evaluation.svg',
      'embedding-models.svg',
      'retrieval-lexical.svg',
      'retrieval-paraphrase.svg',
    ]);
    for (const [name, svg] of Object.entries(charts)) {
      const committed = await readFile(`${root}docs/charts/${name}`, 'utf-8');
      expect(committed, `${name} is out of date, run pnpm charts`).toBe(svg);
    }
  });

  it('chart values equal the recorded headline numbers', async () => {
    const charts = await buildCharts(`${root}eval/results`);
    const lexical = charts['retrieval-lexical.svg'] ?? '';
    expect(lexical).toContain('>0.857<'); // default recall@5, README table
    expect(lexical).toContain('>0.720<'); // default MRR
    const paraphrase = charts['retrieval-paraphrase.svg'] ?? '';
    expect(paraphrase).toContain('>0.960<');
    expect(paraphrase).toContain('>0.900<');
  });
});
