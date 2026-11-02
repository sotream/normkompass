import { describe, expect, it, vi } from 'vitest';
import { ConfigurationError, createAnswerModel, describeAnswerModel } from './claude-model.js';
import { OpenAiCompatibleAnswerModel, endpointHost } from './openai-compatible-model.js';
import { makeHit } from './test-hits.js';

const sources = [{ number: 1, hit: makeHit({ text: '(1) Rechnung ist jedes Dokument.' }) }];
const KEY = 'test-secret-key-123';
const config = { baseUrl: 'https://llm.example.com/v1beta/openai/', apiKey: KEY, model: 'm-1' };

const ok = (content: unknown): Response =>
  new Response(JSON.stringify({ choices: [{ message: { role: 'assistant', content } }] }), {
    status: 200,
  });
const limited = (retryAfter?: string): Response =>
  new Response('slow down', {
    status: 429,
    headers: retryAfter ? { 'retry-after': retryAfter } : {},
  });

function setup(responses: (Response | Error)[], minIntervalMs = 0, maxRetries?: number) {
  const queue = [...responses];
  const f = vi.fn<typeof fetch>(() => {
    const next = queue.shift();
    if (!next) throw new Error('no more responses');
    return next instanceof Error ? Promise.reject(next) : Promise.resolve(next);
  });
  let clock = 0;
  const waits: number[] = [];
  const sleep = (ms: number): Promise<void> => {
    waits.push(ms);
    clock += ms;
    return Promise.resolve();
  };
  const model = new OpenAiCompatibleAnswerModel(
    { ...config, minIntervalMs, maxRetries },
    f,
    sleep,
    () => clock,
  );
  return { f, model, waits };
}

describe('OpenAiCompatibleAnswerModel', () => {
  it('makes one request to the configured endpoint with auth, model and schema', async () => {
    const { f, model } = setup([ok('{"refused":true,"answer":"","citations":[]}')]);
    const out = await model.generate({ question: 'Was ist eine Rechnung?', sources });
    expect(out).toBe('{"refused":true,"answer":"","citations":[]}');
    expect(f).toHaveBeenCalledOnce();
    const [url, init] = f.mock.calls[0]!;
    expect(url).toBe('https://llm.example.com/v1beta/openai/chat/completions');
    expect((init?.headers as Record<string, string>).Authorization).toBe(`Bearer ${KEY}`);
    const body = JSON.parse(init?.body as string) as Record<string, unknown>;
    expect(body).toMatchObject({ model: 'm-1', temperature: 0 });
    const format = body.response_format as {
      type: string;
      json_schema: { strict: boolean; schema: { required: string[] } };
    };
    expect(format.type).toBe('json_schema');
    expect(format.json_schema.schema.required).toEqual(['refused', 'answer', 'citations']);
    const messages = body.messages as { role: string; content: string }[];
    expect(messages[0]?.role).toBe('system');
    expect(messages[1]?.content).toContain('(1) Rechnung ist jedes Dokument.');
    expect(JSON.stringify(body)).not.toContain(KEY);
  });

  it('fails on a non-success status without leaking the key', async () => {
    const { model } = setup([new Response('bad key', { status: 401 })]);
    const error = await model.generate({ question: 'F?', sources }).catch((e: unknown) => e);
    expect(String(error)).toMatch(/status 401/);
    expect(String(error)).not.toContain(KEY);
  });

  it('fails when the endpoint is unreachable', async () => {
    const { model } = setup([new TypeError('fetch failed')]);
    await expect(model.generate({ question: 'F?', sources })).rejects.toThrow(/fetch failed/);
  });

  it('fails on a malformed body', async () => {
    const { model } = setup([new Response(JSON.stringify({ choices: [] }), { status: 200 })]);
    await expect(model.generate({ question: 'F?', sources })).rejects.toThrow(/no content/);
  });

  it('retries a rate-limit answer and uses the successful attempt', async () => {
    const { f, model, waits } = setup([limited('2'), ok('{"refused":true}')]);
    expect(await model.generate({ question: 'F?', sources })).toBe('{"refused":true}');
    expect(f).toHaveBeenCalledTimes(2);
    expect(waits).toEqual([2000]);
  });

  it('retries a temporary-unavailability answer too', async () => {
    const { f, model } = setup([new Response('busy', { status: 503 }), ok('{"refused":true}')]);
    expect(await model.generate({ question: 'F?', sources })).toBe('{"refused":true}');
    expect(f).toHaveBeenCalledTimes(2);
  });

  it('gives up after the retry bound', async () => {
    const { f, model } = setup([limited('1'), limited('1'), limited('1')], 0, 2);
    await expect(model.generate({ question: 'F?', sources })).rejects.toThrow(/status 429/);
    expect(f).toHaveBeenCalledTimes(3);
  });

  it('keeps the minimum interval between requests', async () => {
    const { model, waits } = setup([ok('a'), ok('b')], 6000);
    await model.generate({ question: 'F?', sources });
    await model.generate({ question: 'F?', sources });
    expect(waits).toEqual([6000]);
  });
});

describe('openai-compatible configuration', () => {
  const env = {
    ANSWER_PROVIDER: 'openai-compatible',
    ANSWER_BASE_URL: 'https://llm.example.com/v1/',
    ANSWER_API_KEY: KEY,
    ANSWER_MODEL: 'm-1',
  };

  it('is selected by ANSWER_PROVIDER and labeled with the host, never the key', () => {
    expect(createAnswerModel(env)).toBeInstanceOf(OpenAiCompatibleAnswerModel);
    const label = describeAnswerModel(env);
    expect(label).toEqual({ provider: 'openai-compatible', model: 'm-1', host: 'llm.example.com' });
    expect(JSON.stringify(label)).not.toContain(KEY);
  });

  it.each(['ANSWER_BASE_URL', 'ANSWER_API_KEY', 'ANSWER_MODEL'])(
    'names the missing setting %s',
    (name) => {
      const partial = { ...env, [name]: '' };
      expect(() => createAnswerModel(partial)).toThrow(ConfigurationError);
      expect(() => createAnswerModel(partial)).toThrow(name);
    },
  );

  it('rejects an invalid interval and an unknown provider', () => {
    expect(() => createAnswerModel({ ...env, ANSWER_MIN_INTERVAL_MS: 'abc' })).toThrow(
      ConfigurationError,
    );
    expect(() => createAnswerModel({ ...env, ANSWER_PROVIDER: 'other' })).toThrow(
      /openai-compatible/,
    );
  });

  it('extracts only the host from a base URL', () => {
    expect(endpointHost('https://user:pw@api.example.com:8443/path?x=1')).toBe(
      'api.example.com:8443',
    );
  });
});
