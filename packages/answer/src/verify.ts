import type { SearchHit } from '@normkompass/search';
import type { ProposedCitation, Source } from './types.js';

export type Rejection = 'unknown-chunk' | 'empty-quote' | 'quote-not-found';

export interface VerifiedCitation {
  quote: string;
  hit: SearchHit;
}

export interface Verification {
  valid: VerifiedCitation[];
  rejected: { citation: ProposedCitation; reason: Rejection }[];
}

/**
 * Checks every proposed citation in code: the chunk must be one of the retrieved sources and the
 * quote must be a non-empty, verbatim substring of that chunk's text.
 */
export function verifyCitations(citations: ProposedCitation[], sources: Source[]): Verification {
  const byNumber = new Map(sources.map((s) => [s.number, s.hit]));
  const result: Verification = { valid: [], rejected: [] };
  for (const citation of citations) {
    const hit = byNumber.get(citation.chunk);
    if (!hit) result.rejected.push({ citation, reason: 'unknown-chunk' });
    else if (citation.quote.trim() === '')
      result.rejected.push({ citation, reason: 'empty-quote' });
    else if (!hit.text.includes(citation.quote)) {
      result.rejected.push({ citation, reason: 'quote-not-found' });
    } else result.valid.push({ quote: citation.quote, hit });
  }
  return result;
}
