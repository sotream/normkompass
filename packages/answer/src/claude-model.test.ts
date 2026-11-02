import type Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it, vi } from 'vitest';
import { ClaudeAnswerModel, ConfigurationError, createAnswerModel } from './claude-model.js';
import { makeHit } from './test-hits.js';

const sources = [{ number: 1, hit: makeHit({ text: '(1) Rechnung ist jedes Dokument.' }) }];

function clientReturning(message: Partial<Anthropic.Message>) {
  const create = vi.fn<
    (p: Anthropic.MessageCreateParamsNonStreaming) => Promise<Anthropic.Message>
  >(() => Promise.resolve(message as Anthropic.Message));
  return { client: { messages: { create } }, create };
}

describe('createAnswerModel', () => {
  it('fails with a clear error and no network access when configuration is missing', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    expect(() => createAnswerModel({})).toThrow(ConfigurationError);
    expect(() => createAnswerModel({})).toThrow(/ANTHROPIC_API_KEY and ANSWER_MODEL/);
    expect(() => createAnswerModel({ ANTHROPIC_API_KEY: 'k' })).toThrow(/set ANSWER_MODEL/);
    expect(() => createAnswerModel({ ANSWER_MODEL: 'm' })).toThrow(/set ANTHROPIC_API_KEY/);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('builds a model when both variables are set', () => {
    expect(createAnswerModel({ ANTHROPIC_API_KEY: 'k', ANSWER_MODEL: 'm' })).toBeInstanceOf(
      ClaudeAnswerModel,
    );
  });
});

describe('ClaudeAnswerModel', () => {
  it('sends the configured model id, the system prompt and a JSON schema output format', async () => {
    const { client, create } = clientReturning({
      stop_reason: 'end_turn',
      content: [
        { type: 'text', text: '{"refused":true,"answer":"","citations":[]}' },
      ] as Anthropic.ContentBlock[],
    });
    const model = new ClaudeAnswerModel({ apiKey: 'k', model: 'configured-model-id' }, client);
    const out = await model.generate({ question: 'Was ist eine Rechnung?', sources });
    expect(out).toBe('{"refused":true,"answer":"","citations":[]}');
    const params = create.mock.calls[0]![0];
    expect(params.model).toBe('configured-model-id');
    expect(params.system).toMatch(/ONLY the numbered sources/);
    expect(params.output_config?.format?.type).toBe('json_schema');
    expect(JSON.stringify(params.messages)).toContain('(1) Rechnung ist jedes Dokument.');
    expect(params).not.toHaveProperty('tool_choice');
    expect(params).not.toHaveProperty('temperature');
  });

  it('joins text blocks and ignores other blocks', async () => {
    const { client } = clientReturning({
      stop_reason: 'end_turn',
      content: [
        { type: 'thinking', thinking: '', signature: 's' },
        { type: 'text', text: '{"a":' },
        { type: 'text', text: '1}' },
      ] as Anthropic.ContentBlock[],
    });
    const out = await new ClaudeAnswerModel({ apiKey: 'k', model: 'm' }, client).generate({
      question: 'F?',
      sources,
    });
    expect(out).toBe('{"a":1}');
  });

  it('turns a safety refusal into a refused output instead of an error', async () => {
    const { client } = clientReturning({ stop_reason: 'refusal', content: [] });
    const out = await new ClaudeAnswerModel({ apiKey: 'k', model: 'm' }, client).generate({
      question: 'F?',
      sources,
    });
    expect(JSON.parse(out)).toEqual({ refused: true, answer: '', citations: [] });
  });
});
