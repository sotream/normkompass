import type { SearchHit } from '@normkompass/search';
import { parseModelOutput } from './parse.js';
import type {
  AnswerModel,
  AnswerResponse,
  AskResult,
  Diagnostics,
  RefusalReason,
  Retriever,
  Source,
} from './types.js';
import { verifyCitations } from './verify.js';

export const DEFAULT_SOURCE_COUNT = 8;

export interface PipelineOptions {
  /** Number of retrieved chunks given to the model. */
  sources?: number;
  /** Called with the error when the model call fails; the response is a refusal either way. */
  onModelError?: (error: unknown) => void;
}

const REFUSAL: AnswerResponse = { answer: '', citations: [], refused: true, stand: null };

/** Stand statements of the cited laws, one per law: "UStG: <Stand>; DDG: <Stand>". */
export function standOf(hits: SearchHit[]): string | null {
  const parts = new Map<string, string>();
  for (const h of hits) if (h.stand && !parts.has(h.source)) parts.set(h.source, h.stand);
  return parts.size === 0
    ? null
    : [...parts].map(([source, stand]) => `${source}: ${stand}`).join('; ');
}

/** question -> retrieval -> model -> code-level verification -> response. */
export class AnswerPipeline {
  constructor(
    private readonly retriever: Retriever,
    private readonly model: AnswerModel,
    private readonly options: PipelineOptions = {},
  ) {}

  async ask(question: string): Promise<AskResult> {
    const hits = await this.retriever.search(question, {
      limit: this.options.sources ?? DEFAULT_SOURCE_COUNT,
    });
    const base: Diagnostics = {
      retrieved: hits.length,
      proposedCitations: 0,
      validCitations: 0,
      citedUnitIds: [],
    };
    const refuse = (reason: RefusalReason, extra: Partial<Diagnostics> = {}): AskResult => ({
      response: { ...REFUSAL, citations: [] },
      diagnostics: { ...base, ...extra, reason },
    });

    if (hits.length === 0) return refuse('no-retrieval');
    const sources: Source[] = hits.map((hit, i) => ({ number: i + 1, hit }));

    let raw: string;
    try {
      raw = await this.model.generate({ question, sources });
    } catch (error) {
      this.options.onModelError?.(error);
      return refuse('model-error');
    }

    const output = parseModelOutput(raw);
    if (!output) return refuse('unparsable-output');
    if (output.refused) return refuse('model-refused');

    const { valid, rejected } = verifyCitations(output.citations, sources);
    const counts = { proposedCitations: output.citations.length, validCitations: valid.length };
    if (output.citations.length === 0) return refuse('no-citations', counts);
    if (rejected.length > 0) {
      return refuse('citation-rejected', {
        ...counts,
        citedUnitIds: valid.map((v) => v.hit.unitId),
      });
    }
    if (output.answer.trim() === '') return refuse('empty-answer', counts);

    return {
      response: {
        answer: output.answer,
        // Source, path and URL come from the stored chunk, never from the model.
        citations: valid.map(({ hit, quote }) => ({
          source: hit.source,
          path: hit.path.join(' '),
          url: hit.url,
          quote,
        })),
        refused: false,
        stand: standOf(valid.map((v) => v.hit)),
      },
      diagnostics: { ...base, ...counts, citedUnitIds: valid.map((v) => v.hit.unitId) },
    };
  }
}
