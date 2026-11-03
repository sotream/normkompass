import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { CorpusUnit } from '@normkompass/corpus';
import { HybridSearch, createEmbedder, createPool, indexUnits, migrate } from '@normkompass/search';
import { TextFolderSource } from './text-folder-source.js';

/** Own schema, so the example never mixes its chunks into the main index. */
const SCHEMA = 'example_own_corpus';

if (existsSync('.env')) process.loadEnvFile('.env');
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is not set (see .env.example).');
  process.exit(1);
}
const question = process.argv.slice(2).join(' ') || 'Wie viele Urlaubstage habe ich?';

const source = new TextFolderSource(join(import.meta.dirname, '..', 'docs'));
const units: CorpusUnit[] = [];
for await (const doc of source.loadDocuments()) units.push(...source.split(doc).units);

// "fake" needs no model download; set EMBEDDER=local-e5 for real embeddings.
const embedder = createEmbedder(process.env.EMBEDDER ?? 'fake');
const pool = createPool({ connectionString, schema: SCHEMA });
try {
  await migrate(pool, SCHEMA);
  const result = await indexUnits(pool, embedder, units);
  console.log(`Indexed ${result.chunks} chunks from ${units.length} units (${embedder.model}).`);
  console.log(`\nQuestion: ${question}`);
  for (const hit of await new HybridSearch(pool, embedder).search(question, { limit: 3 })) {
    console.log(`  ${hit.label}: ${hit.text}`);
  }
} finally {
  await pool.end();
}
