import type { OnModuleDestroy } from '@nestjs/common';
import {
  HybridSearch,
  createEmbedder,
  createPool,
  type Pool,
  type SearchHit,
} from '@normkompass/search';

export const SEARCH_SERVICE = Symbol('SEARCH_SERVICE');

/** What the controller needs from search; tests replace it with a stub. */
export interface SearchPort {
  search(question: string, limit: number): Promise<SearchHit[]>;
}

export class DatabaseSearchService implements SearchPort, OnModuleDestroy {
  private readonly pool: Pool;
  private readonly hybrid: HybridSearch;

  constructor(connectionString: string, embedderName: string | undefined) {
    this.pool = createPool({ connectionString });
    this.hybrid = new HybridSearch(this.pool, createEmbedder(embedderName));
  }

  search(question: string, limit: number): Promise<SearchHit[]> {
    return this.hybrid.search(question, { limit });
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}

export function createSearchService(env: NodeJS.ProcessEnv = process.env): SearchPort {
  const url = env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set (see .env.example)');
  return new DatabaseSearchService(url, env.EMBEDDER);
}
