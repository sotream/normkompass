import { Logger } from '@nestjs/common';
import {
  AnswerPipeline,
  createAnswerModel,
  type AnswerModel,
  type AnswerResponse,
} from '@normkompass/answer';
import type { SearchPort } from './search.service.js';

export const ASK_SERVICE = Symbol('ASK_SERVICE');

export interface AskPort {
  ask(question: string): Promise<AnswerResponse>;
}

/**
 * Wires retrieval to the answer pipeline. The Claude client is created on first use, so the API
 * (health, search) runs without an API key; a missing key surfaces as a ConfigurationError on /ask.
 */
export class PipelineAskService implements AskPort {
  private readonly logger = new Logger('AskService');
  private pipeline: AnswerPipeline | undefined;

  constructor(
    private readonly search: SearchPort,
    private readonly makeModel: () => AnswerModel = () => createAnswerModel(),
  ) {}

  async ask(question: string): Promise<AnswerResponse> {
    this.pipeline ??= new AnswerPipeline(
      { search: (q, { limit }) => this.search.search(q, limit) },
      this.makeModel(),
      {
        onModelError: (e) => {
          this.logger.error(`Model call failed: ${String(e)}`);
        },
      },
    );
    return (await this.pipeline.ask(question)).response;
  }
}
