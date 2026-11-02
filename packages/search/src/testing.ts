import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseStatute, type CorpusUnit } from '@normkompass/corpus';
import { createPool, migrate, type Pool } from './db.js';

export const DATABASE_URL = process.env.DATABASE_URL;

const FIXTURES = join(import.meta.dirname, '../../corpus/test/fixtures/statutes');

export const FIXTURE_SLUGS = ['ustg_1980', 'ustdv_1980', 'ao_1977', 'bdsg_2018', 'ddg'] as const;

export function fixtureUnits(slugs: readonly string[] = FIXTURE_SLUGS): CorpusUnit[] {
  return slugs.flatMap(
    (slug) => parseStatute(readFileSync(join(FIXTURES, `${slug}.xml`), 'utf-8'), { slug }).units,
  );
}

/** A throwaway schema, so integration tests never touch real data. */
export async function createTestDb(): Promise<{ pool: Pool; drop: () => Promise<void> }> {
  if (!DATABASE_URL) throw new Error('DATABASE_URL is not set');
  const schema = `test_${randomBytes(6).toString('hex')}`;
  const pool = createPool({ connectionString: DATABASE_URL, schema });
  await migrate(pool, schema);
  return {
    pool,
    drop: async () => {
      await pool.query(`DROP SCHEMA ${schema} CASCADE`);
      await pool.end();
    },
  };
}
