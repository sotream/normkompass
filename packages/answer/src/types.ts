import type { SearchHit } from '@normkompass/search';

/** A retrieved chunk as shown to the model, with the number the model must cite it by. */
export interface Source {
  number: number;
  hit: SearchHit;
}

/** What the model is asked to return (a JSON object). */
export interface ModelOutput {
  refused: boolean;
  answer: string;
  citations: ProposedCitation[];
}

export interface ProposedCitation {
  chunk: number;
  quote: string;
}

export interface Citation {
  source: string;
  path: string;
  url: string;
  quote: string;
}

/** The public response of the ask endpoint. */
export interface AnswerResponse {
  answer: string;
  citations: Citation[];
  refused: boolean;
  stand: string | null;
}

export type RefusalReason =
  | 'no-retrieval'
  | 'model-error'
  | 'unparsable-output'
  | 'model-refused'
  | 'empty-answer'
  | 'no-citations'
  | 'citation-rejected';

/** Extra information for evaluation; never returned to API clients. */
export interface Diagnostics {
  retrieved: number;
  proposedCitations: number;
  validCitations: number;
  /** Unit ids of the verified citations. */
  citedUnitIds: string[];
  reason?: RefusalReason;
}

export interface AskResult {
  response: AnswerResponse;
  diagnostics: Diagnostics;
}

/**
 * The language model behind the pipeline: gets the question and numbered sources and returns the
 * raw text of its JSON output. Parsing and checking are done by the pipeline, not by the model.
 */
export interface AnswerModel {
  generate(input: { question: string; sources: Source[] }): Promise<string>;
}

export interface Retriever {
  search(question: string, options: { limit: number }): Promise<SearchHit[]>;
}
