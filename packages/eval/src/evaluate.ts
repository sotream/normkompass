import type { HybridSearch, SearchOptions } from '@normkompass/search';
import { aggregate, scoreQuestion, type Metrics, type QuestionResult } from './metrics.js';
import type { Question } from './questions.js';

/** Runs every answerable question through search and scores the ranking. */
export async function evaluateRetrieval(
  search: HybridSearch,
  questions: Question[],
  depth = 10,
  searchOptions: Omit<SearchOptions, 'limit'> = {},
): Promise<{ metrics: Metrics; results: QuestionResult[] }> {
  const results: QuestionResult[] = [];
  for (const q of questions.filter((x) => x.answerable)) {
    const hits = await search.search(q.question, { ...searchOptions, limit: depth });
    results.push(
      scoreQuestion(
        q,
        hits.map((h) => h.unitId),
      ),
    );
  }
  return { metrics: aggregate(results), results };
}
