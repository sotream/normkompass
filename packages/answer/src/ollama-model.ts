import { OUTPUT_SCHEMA, SYSTEM_PROMPT, buildUserMessage } from './prompt.js';
import type { AnswerModel, Source } from './types.js';

export const DEFAULT_OLLAMA_URL = 'http://localhost:11434';

export interface OllamaConfig {
  /** Base URL of the Ollama server. */
  url: string;
  /** Name of a model that has been pulled into Ollama; there is no default. */
  model: string;
}

/** Context window for 8 sources of up to 1500 characters plus the instructions. */
const NUM_CTX = 8192;

/**
 * Answer model backed by a locally running Ollama server. Question and sources are sent only to the
 * configured URL. Temperature 0 and a fixed seed make a run repeatable on the same model.
 */
export class OllamaAnswerModel implements AnswerModel {
  constructor(
    private readonly config: OllamaConfig,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async generate({ question, sources }: { question: string; sources: Source[] }): Promise<string> {
    const url = `${this.config.url.replace(/\/+$/, '')}/api/chat`;
    const res = await this.fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.config.model,
        stream: false,
        format: OUTPUT_SCHEMA,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: buildUserMessage(question, sources) },
        ],
        options: { temperature: 0, seed: 0, num_ctx: NUM_CTX },
      }),
    });
    if (!res.ok) throw new Error(`Ollama request failed with status ${res.status}`);
    const body = (await res.json()) as { message?: { content?: unknown } };
    const content = body.message?.content;
    if (typeof content !== 'string') throw new Error('Ollama response has no message content');
    return content;
  }
}
