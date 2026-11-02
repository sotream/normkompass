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

export const DEFAULT_MAX_RETRIES = 6;
/** First backoff ceiling; it doubles with every attempt (full jitter: the wait is random up to the ceiling). */
const BACKOFF_BASE_MS = 4_000;
const BACKOFF_CAP_MS = 60_000;
/** A server-requested wait (Retry-After) is honored up to this long; longer means the call fails. */
const MAX_SERVER_WAIT_MS = 120_000;
/** A request that has not answered after this long is abandoned and counts as a failed attempt. */
const REQUEST_TIMEOUT_MS = 120_000;
/** Overloaded or rate-limited answers are worth retrying; other client errors (bad key, unknown model) are not. */
const RETRYABLE = new Set([408, 429, 500, 502, 503, 504]);

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
 * sent only to the configured base URL. Requests are spaced by a minimum interval. Transient failures
 * (HTTP 408, 429, 5xx, a dropped connection, a timeout) are retried a bounded number of times with
 * exponential backoff and full jitter, never sooner than the server's Retry-After. A rate-limit answer
 * (429) also widens the spacing between later requests; it shrinks again after successes. Failures never
 * include the key or the response body.
 */
export class OpenAiCompatibleAnswerModel implements AnswerModel {
  private lastStart = Number.NEGATIVE_INFINITY;
  private interval: number;

  constructor(
    private readonly config: OpenAiCompatibleConfig,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly sleep: (ms: number) => Promise<void> = realSleep,
    private readonly now: () => number = Date.now,
    private readonly random: () => number = Math.random,
  ) {
    this.interval = config.minIntervalMs ?? 0;
  }

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
      let res: Response;
      try {
        res = await this.fetchImpl(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.config.apiKey}`,
          },
          body,
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
      } catch (error) {
        // Dropped connection or timeout: transient, same backoff.
        if (attempt >= maxRetries) throw error;
        await this.sleep(this.backoff(attempt, null));
        continue;
      }
      if (res.ok) {
        this.interval = Math.max(this.config.minIntervalMs ?? 0, this.interval / 2);
        const json = (await res.json()) as { choices?: { message?: { content?: unknown } }[] };
        const content = json.choices?.[0]?.message?.content;
        if (typeof content !== 'string') throw new Error('Answer endpoint response has no content');
        return content;
      }
      if (res.status === 429) {
        this.interval = Math.min(Math.max(this.interval * 2, BACKOFF_BASE_MS), BACKOFF_CAP_MS);
      }
      if (RETRYABLE.has(res.status) && attempt < maxRetries) {
        const serverWait = retryAfterMs(res);
        if (serverWait !== null && serverWait > MAX_SERVER_WAIT_MS) {
          throw new Error(`Answer endpoint asked to wait too long (status ${res.status})`);
        }
        await this.sleep(this.backoff(attempt, serverWait));
        continue;
      }
      const hint = res.status === 404 ? ' (is ANSWER_MODEL available to this key?)' : '';
      throw new Error(`Answer endpoint request failed with status ${res.status}${hint}`);
    }
  }

  /** Full-jitter exponential backoff, but never less than what the server asked for. */
  private backoff(attempt: number, serverWait: number | null): number {
    const ceiling = Math.min(BACKOFF_CAP_MS, BACKOFF_BASE_MS * 2 ** attempt);
    return Math.max(serverWait ?? 0, Math.round(this.random() * ceiling));
  }

  private async waitForTurn(): Promise<void> {
    const wait = this.lastStart + this.interval - this.now();
    if (wait > 0) await this.sleep(wait);
    this.lastStart = this.now();
  }
}

/** Retry-After in seconds (the form these endpoints use), as milliseconds; null if absent or unusable. */
function retryAfterMs(res: Response): number | null {
  const header = res.headers.get('retry-after');
  if (header === null) return null;
  const seconds = Number(header);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : null;
}
