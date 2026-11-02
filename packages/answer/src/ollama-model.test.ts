import { describe, expect, it, vi } from 'vitest';
import { ConfigurationError, createAnswerModel, describeAnswerModel } from './claude-model.js';
import { OllamaAnswerModel } from './ollama-model.js';
import { makeHit } from './test-hits.js';

const sources = [{ number: 1, hit: makeHit({ text: '(1) Rechnung ist jedes Dokument.' }) }];

function fakeFetch(response: Response | Error) {
  return vi.fn<typeof fetch>(() =>
    response instanceof Error ? Promise.reject(response) : Promise.resolve(response),
  );
}
const ok = (content: unknown): Response =>
  new Response(JSON.stringify({ message: { role: 'assistant', content } }), { status: 200 });

describe('OllamaAnswerModel', () => {
  it('makes exactly one request to the configured URL with the model, schema and fixed sampling', async () => {
    const f = fakeFetch(ok('{"refused":true,"answer":"","citations":[]}'));
    const model = new OllamaAnswerModel(
      { url: 'http://ollama.internal:11434/', model: 'local-model' },
      f,
    );
    const out = await model.generate({ question: 'Was ist eine Rechnung?', sources });
    expect(out).toBe('{"refused":true,"answer":"","citations":[]}');
    expect(f).toHaveBeenCalledOnce();
    const [url, init] = f.mock.calls[0]!;
    expect(url).toBe('http://ollama.internal:11434/api/chat');
    expect(init?.method).toBe('POST');
    const body = JSON.parse(init?.body as string) as Record<string, unknown>;
    expect(body).toMatchObject({
      model: 'local-model',
      stream: false,
      options: { temperature: 0, seed: 0 },
    });
    expect((body.format as { required: string[] }).required).toEqual([
      'refused',
      'answer',
      'citations',
    ]);
    const messages = body.messages as { role: string; content: string }[];
    expect(messages[0]?.role).toBe('system');
    expect(messages[1]?.content).toContain('(1) Rechnung ist jedes Dokument.');
  });

  it('fails on a non-success status', async () => {
    const model = new OllamaAnswerModel(
      { url: 'http://localhost:11434', model: 'm' },
      fakeFetch(new Response('model not found', { status: 404 })),
    );
    await expect(model.generate({ question: 'F?', sources })).rejects.toThrow(/status 404/);
  });

  it('fails when the server is unreachable', async () => {
    const model = new OllamaAnswerModel(
      { url: 'http://localhost:11434', model: 'm' },
      fakeFetch(new TypeError('fetch failed')),
    );
    await expect(model.generate({ question: 'F?', sources })).rejects.toThrow(/fetch failed/);
  });

  it('fails on a malformed body', async () => {
    const model = new OllamaAnswerModel(
      { url: 'http://localhost:11434', model: 'm' },
      fakeFetch(ok(42)),
    );
    await expect(model.generate({ question: 'F?', sources })).rejects.toThrow(/no message content/);
  });
});

describe('provider selection', () => {
  it('uses Claude when no provider is configured', () => {
    expect(() => createAnswerModel({})).toThrow(/ANTHROPIC_API_KEY and ANSWER_MODEL/);
    expect(describeAnswerModel({ ANTHROPIC_API_KEY: 'k', ANSWER_MODEL: 'm' })).toEqual({
      provider: 'claude',
      model: 'm',
    });
  });

  it('rejects an unknown provider without any request', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    expect(() => createAnswerModel({ ANSWER_PROVIDER: 'openai' })).toThrow(ConfigurationError);
    expect(() => createAnswerModel({ ANSWER_PROVIDER: 'openai' })).toThrow(/"claude" or "ollama"/);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('needs OLLAMA_MODEL for the Ollama provider and has no default model', () => {
    expect(() => createAnswerModel({ ANSWER_PROVIDER: 'ollama' })).toThrow(/set OLLAMA_MODEL/);
    expect(() =>
      createAnswerModel({
        ANSWER_PROVIDER: 'ollama',
        ANSWER_MODEL: 'claude-x',
        ANTHROPIC_API_KEY: 'k',
      }),
    ).toThrow(/set OLLAMA_MODEL/);
  });

  it('builds the Ollama model without an Anthropic key', () => {
    const env = { ANSWER_PROVIDER: 'ollama', OLLAMA_MODEL: 'local-model' };
    expect(createAnswerModel(env)).toBeInstanceOf(OllamaAnswerModel);
    expect(describeAnswerModel(env)).toEqual({ provider: 'ollama', model: 'local-model' });
  });
});
