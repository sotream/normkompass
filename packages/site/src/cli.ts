import { join } from 'node:path';
import { buildSite, currentCommit } from './build.js';

const root = process.cwd();
const out = join(root, 'site');
const errors = await buildSite(root, out, currentCommit(root));
if (errors.length > 0) {
  console.error(
    `The site has ${errors.length} problem(s):\n${errors.map((e) => `  - ${e}`).join('\n')}`,
  );
  process.exit(1);
}
console.log(`Site written to ${out}`);
