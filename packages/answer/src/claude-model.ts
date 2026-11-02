import Anthropic from '@anthropic-ai/sdk';
import { OUTPUT_SCHEMA, SYSTEM_PROMPT, buildUserMessage } from './prompt.js';
import { DEFAULT_OLLAMA_URL, OllamaAnswerModel } from './ollama-model.js';
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

export type AnswerProvider = 'claude' | 'ollama';

/** An empty value in .env means "not set". */
const setting = (value: string | undefined): string | undefined =>
  value === undefined || value === '' ? undefined : value;

function providerOf(env: NodeJS.ProcessEnv): AnswerProvider {
  const provider = setting(env.ANSWER_PROVIDER) ?? 'claude';
  if (provider !== 'claude' && provider !== 'ollama') {
    throw new ConfigurationError(
      `Unknown ANSWER_PROVIDER "${provider}": use "claude" or "ollama" (see .env.example).`,
    );
  }
  return provider;
}

/** Provider and model name for labeling results; throws ConfigurationError like createAnswerModel. */
export function describeAnswerModel(env: NodeJS.ProcessEnv = process.env): {
  provider: AnswerProvider;
  model: string;
} {
  const provider = providerOf(env);
  const model = setting(provider === 'ollama' ? env.OLLAMA_MODEL : env.ANSWER_MODEL);
  if (!model) {
    throw new ConfigurationError(
      `Answer generation is not configured: set ${provider === 'ollama' ? 'OLLAMA_MODEL' : 'ANSWER_MODEL'} (see .env.example).`,
    );
  }
  return { provider, model };
}

/**
 * Builds the configured answer model. The default provider is Claude, which needs ANTHROPIC_API_KEY and
 * ANSWER_MODEL; "ollama" needs OLLAMA_MODEL. Throws ConfigurationError before any request is made.
 */
export function createAnswerModel(env: NodeJS.ProcessEnv = process.env): AnswerModel {
  const provider = providerOf(env);
  if (provider === 'ollama') {
    const { model } = describeAnswerModel(env);
    return new OllamaAnswerModel({ url: setting(env.OLLAMA_URL) ?? DEFAULT_OLLAMA_URL, model });
  }
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
