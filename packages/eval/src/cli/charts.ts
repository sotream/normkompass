import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { buildCharts } from '../chart-build.js';

const check = process.argv.includes('--check');
const resultsDir = 'eval/results';
const outDir = 'docs/charts';

const charts = await buildCharts(resultsDir);
if (check) {
  const stale: string[] = [];
  for (const [name, svg] of Object.entries(charts)) {
    const current = await readFile(join(outDir, name), 'utf-8').catch(() => null);
    if (current !== svg) stale.push(name);
  }
  if (stale.length > 0) {
    console.error(
      `Charts out of date: ${stale.join(', ')}. Run pnpm charts and commit the result.`,
    );
    process.exit(1);
  }
  console.log(`${Object.keys(charts).length} charts match the recorded results.`);
} else {
  await mkdir(outDir, { recursive: true });
  for (const [name, svg] of Object.entries(charts)) {
    await writeFile(join(outDir, name), svg);
    console.log(`wrote ${join(outDir, name)}`);
  }
}
