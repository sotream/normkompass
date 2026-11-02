import Anthropic from '@anthropic-ai/sdk';
import { OUTPUT_SCHEMA, SYSTEM_PROMPT, buildUserMessage } from './prompt.js';
import type { AnswerModel, Source } from './types.js';

export class ConfigurationError extends Error {
  override readonly name = 'ConfigurationError';
}

export interface ClaudeModelConfig {
  apiKey: string;
  /** Claude model id; comes from configuration, there is no default. */
  model: string;
}

/** The part of the Anthropic client that is used; lets tests run without the network. */
export interface MessagesClient {
  messages: {
    create(params: Anthropic.MessageCreateParamsNonStreaming): Promise<Anthropic.Message>;
  };
}

const REFUSED = JSON.stringify({ refused: true, answer: '', citations: [] });

export class ClaudeAnswerModel implements AnswerModel {
  constructor(
    private readonly config: ClaudeModelConfig,
    private readonly client: MessagesClient = new Anthropic({ apiKey: config.apiKey }),
  ) {}

  async generate({ question, sources }: { question: string; sources: Source[] }): Promise<string> {
    const response = await this.client.messages.create({
      model: this.config.model,
      max_tokens: 8000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildUserMessage(question, sources) }],
      output_config: { format: { type: 'json_schema', schema: OUTPUT_SCHEMA } },
    });
    // Safety classifiers can decline a request; that is a refusal, not an error.
    if (response.stop_reason === 'refusal') return REFUSED;
    return response.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('');
  }
}

/** Builds the Claude model from environment variables; throws ConfigurationError if incomplete. */
export function createAnswerModel(env: NodeJS.ProcessEnv = process.env): ClaudeAnswerModel {
  const apiKey = env.ANTHROPIC_API_KEY;
  const model = env.ANSWER_MODEL;
  if (!apiKey || !model) {
    const missing = [!apiKey && 'ANTHROPIC_API_KEY', !model && 'ANSWER_MODEL'].filter(Boolean);
    throw new ConfigurationError(
      `Answer generation is not configured: set ${missing.join(' and ')} (see .env.example).`,
    );
  }
  return new ClaudeAnswerModel({ apiKey, model });
}
