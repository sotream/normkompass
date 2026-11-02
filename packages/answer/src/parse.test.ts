import { describe, expect, it } from 'vitest';
import { parseModelOutput } from './parse.js';

describe('parseModelOutput', () => {
  it('parses a valid output and drops fields the model added to a citation', () => {
    const out = parseModelOutput(
      JSON.stringify({
        refused: false,
        answer: 'A',
        citations: [{ chunk: 1, quote: 'q', path: '§ 99', url: 'https://evil.test' }],
      }),
    );
    expect(out).toEqual({ refused: false, answer: 'A', citations: [{ chunk: 1, quote: 'q' }] });
  });

  it.each([
    ['not JSON', 'Ich weiß es nicht.'],
    ['JSON null', 'null'],
    ['array', '[]'],
    ['missing refused', '{"answer":"a","citations":[]}'],
    ['non-boolean refused', '{"refused":"no","answer":"a","citations":[]}'],
    ['non-string answer', '{"refused":false,"answer":1,"citations":[]}'],
    ['non-array citations', '{"refused":false,"answer":"a","citations":{}}'],
    ['non-integer chunk', '{"refused":false,"answer":"a","citations":[{"chunk":1.5,"quote":"q"}]}'],
    ['non-string quote', '{"refused":false,"answer":"a","citations":[{"chunk":1,"quote":3}]}'],
    ['null citation', '{"refused":false,"answer":"a","citations":[null]}'],
  ])('returns null for %s', (_name, raw) => {
    expect(parseModelOutput(raw)).toBeNull();
  });
});
