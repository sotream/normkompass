import type { AnswerModel, Source } from './types.js';

/** A model whose output is decided by a function; used in tests and the CI eval, never calls the network. */
export class ScriptedModel implements AnswerModel {
  calls = 0;

  constructor(
    private readonly script: (input: {
      question: string;
      sources: Source[];
    }) => string | Promise<string>,
  ) {}

  async generate(input: { question: string; sources: Source[] }): Promise<string> {
    this.calls++;
    return this.script(input);
  }
}

/** Output of a model that answers from the first source and quotes its first `length` characters. */
export function answerFromFirstSource(sources: Source[], length = 60): string {
  const first = sources[0];
  if (!first) return JSON.stringify({ refused: true, answer: '', citations: [] });
  return JSON.stringify({
    refused: false,
    answer: `Laut ${first.hit.label}: ${first.hit.text.slice(0, 80)}`,
    citations: [{ chunk: first.number, quote: first.hit.text.slice(0, length) }],
  });
}
