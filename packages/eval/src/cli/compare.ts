import { readFile } from 'node:fs/promises';
import { pairedBootstrap, reciprocalRanks } from '../compare.js';

interface ResultFile {
  embedder: string;
  mode?: string;
  rerank?: string | null;
  perQuestion: { id: string; firstHitRank: number | null; recallAt5: number }[];
}

const [fileA, fileB] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
if (!fileA || !fileB) {
  console.error('Usage: pnpm eval:compare <result-a.json> <result-b.json>   (reports b minus a)');
  process.exit(1);
}
const load = async (f: string): Promise<ResultFile> =>
  JSON.parse(await readFile(f, 'utf-8')) as ResultFile;
const [a, b] = [await load(fileA), await load(fileB)];
const ids = (r: ResultFile): string => r.perQuestion.map((q) => q.id).join(',');
if (ids(a) !== ids(b)) {
  console.error('The two results were not produced from the same questions.');
  process.exit(1);
}
const name = (r: ResultFile): string =>
  `${r.embedder}/${r.mode ?? 'hybrid'}${r.rerank ? '+rerank' : ''}`;
const fmt = (x: number): string => (x >= 0 ? '+' : '') + x.toFixed(3);
console.log(
  `${name(b)} minus ${name(a)} over ${a.perQuestion.length} questions (95% paired bootstrap)`,
);
for (const [metric, f] of [
  ['MRR', (r: ResultFile) => reciprocalRanks(r.perQuestion)],
  ['recall@5', (r: ResultFile) => r.perQuestion.map((q) => q.recallAt5)],
] as const) {
  const r = pairedBootstrap(f(a), f(b));
  console.log(
    `  ${metric}: ${fmt(r.meanDiff)}  [${fmt(r.lo)}, ${fmt(r.hi)}]  ${r.significant ? 'significant' : 'not significant'}`,
  );
}
