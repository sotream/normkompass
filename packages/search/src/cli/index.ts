import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { GesetzeImInternetSource, type CorpusUnit } from '@normkompass/corpus';
import { createPool, migrate, readModelRecord, recordModel } from '../db.js';
import { LocalEmbedder, createEmbedder } from '../embedder.js';
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

const flag = process.argv.indexOf('--embedder');
const embedder = createEmbedder(
  (flag >= 0 ? process.argv[flag + 1] : undefined) ?? process.env.EMBEDDER,
);
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
  const seconds = Math.round((Date.now() - started) / 1000);
  console.log(
    `Done in ${seconds}s: ${result.chunks} chunks, ${result.embedded} embedded, ${result.removed} removed.`,
  );
  // The time is only comparable when everything was embedded in this run.
  const complete = result.embedded === result.chunks;
  const existing = await readModelRecord(pool, embedder.model);
  await recordModel(pool, {
    model: embedder.model,
    dimension: embedder.dimension,
    indexingSeconds: complete ? seconds : (existing?.indexingSeconds ?? null),
    weightsBytes:
      embedder instanceof LocalEmbedder
        ? await embedder.weightsBytes()
        : (existing?.weightsBytes ?? null),
    chunks: result.chunks,
  });
} finally {
  await pool.end();
}
