import { OUTPUT_SCHEMA, SYSTEM_PROMPT, buildUserMessage } from './prompt.js';
import type { AnswerModel, Source } from './types.js';

export interface OpenAiCompatibleConfig {
  /** Base URL of an endpoint that implements the OpenAI-style chat completions API; no default. */
  baseUrl: string;
  /** API key; sent only to `baseUrl`, never logged. */
  apiKey: string;
  /** Model name as the endpoint knows it; no default. */
  model: string;
  /** Minimum time between the starts of two requests, in milliseconds. */
  minIntervalMs?: number;
  /** How many times a "too many requests" answer is retried before the call fails. */
  maxRetries?: number;
}

export const DEFAULT_MAX_RETRIES = 3;
/** Wait before a retry when the endpoint does not say how long to wait, multiplied by the attempt number. */
const RETRY_WAIT_MS = 20_000;
const MAX_RETRY_WAIT_MS = 60_000;
/** A request that has not answered after this long is abandoned (and counts as a failure). */
const REQUEST_TIMEOUT_MS = 120_000;
/** "Too many requests" and "temporarily unavailable" (hosted free tiers shed load) are worth retrying. */
const RETRYABLE = new Set([429, 503]);

const realSleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Host part of a base URL, for labeling results without the path or any credentials. */
export function endpointHost(baseUrl: string): string {
  try {
    return new URL(baseUrl).host;
  } catch {
    return 'invalid-url';
  }
}

/**
 * Answer model backed by any endpoint with an OpenAI-style chat completions API. Question and sources are
 * sent only to the configured base URL. Requests are spaced by a minimum interval, and a rate-limit or
 * temporary-unavailability answer (HTTP 429, 503) is retried a bounded number of times. Failures never include the key.
 */
export class OpenAiCompatibleAnswerModel implements AnswerModel {
  private lastStart = Number.NEGATIVE_INFINITY;

  constructor(
    private readonly config: OpenAiCompatibleConfig,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly sleep: (ms: number) => Promise<void> = realSleep,
    private readonly now: () => number = Date.now,
  ) {}

  async generate({ question, sources }: { question: string; sources: Source[] }): Promise<string> {
    const url = `${this.config.baseUrl.replace(/\/+$/, '')}/chat/completions`;
    const body = JSON.stringify({
      model: this.config.model,
      temperature: 0,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildUserMessage(question, sources) },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'answer', strict: true, schema: OUTPUT_SCHEMA },
      },
    });
    const maxRetries = this.config.maxRetries ?? DEFAULT_MAX_RETRIES;

    for (let attempt = 0; ; attempt++) {
      await this.waitForTurn();
      const res = await this.fetchImpl(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (RETRYABLE.has(res.status) && attempt < maxRetries) {
        await this.sleep(retryWait(res, attempt + 1));
        continue;
      }
      if (!res.ok) throw new Error(`Answer endpoint request failed with status ${res.status}`);
      const json = (await res.json()) as { choices?: { message?: { content?: unknown } }[] };
      const content = json.choices?.[0]?.message?.content;
      if (typeof content !== 'string') throw new Error('Answer endpoint response has no content');
      return content;
    }
  }

  private async waitForTurn(): Promise<void> {
    const interval = this.config.minIntervalMs ?? 0;
    const wait = this.lastStart + interval - this.now();
    if (wait > 0) await this.sleep(wait);
    this.lastStart = this.now();
  }
}

function retryWait(res: Response, attempt: number): number {
  const seconds = Number(res.headers.get('retry-after'));
  const asked = Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : RETRY_WAIT_MS * attempt;
  return Math.min(asked, MAX_RETRY_WAIT_MS);
}
