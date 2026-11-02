import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { GesetzeImInternetSource, type CorpusUnit } from '@normkompass/corpus';
import { createPool, migrate } from '../db.js';
import { createEmbedder } from '../embedder.js';
import { indexUnits } from '../indexer.js';

if (existsSync('.env')) process.loadEnvFile('.env');
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is not set (see .env.example).');
  process.exit(1);
}

const source = new GesetzeImInternetSource({
  cacheDir: join(process.cwd(), '.cache', 'gesetze-im-internet'),
});
const units: CorpusUnit[] = [];
for await (const doc of source.loadDocuments()) units.push(...source.split(doc).units);

const embedder = createEmbedder(process.env.EMBEDDER);
const pool = createPool({ connectionString });
try {
  await migrate(pool);
  console.log(`Indexing ${units.length} units with ${embedder.model} ...`);
  const started = Date.now();
  const result = await indexUnits(pool, embedder, units, {
    onProgress: (done, total) => {
      if (done === total || done % 320 === 0) console.log(`  embedded ${done}/${total}`);
    },
  });
  console.log(
    `Done in ${Math.round((Date.now() - started) / 1000)}s: ${result.chunks} chunks, ` +
      `${result.embedded} embedded, ${result.removed} removed.`,
  );
} finally {
  await pool.end();
}
