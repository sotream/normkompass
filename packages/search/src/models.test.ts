import { describe, expect, it } from 'vitest';
import { EMBEDDER_NAMES, LOCAL_MODELS, createEmbedder } from './embedder.js';
import { OverlapReranker } from './reranker.js';

describe('embedder registry', () => {
  it('creates every listed embedder without loading a model', () => {
    for (const name of EMBEDDER_NAMES) {
      const embedder = createEmbedder(name);
      expect(embedder.model).toBeTruthy();
      expect(embedder.dimension).toBeGreaterThan(0);
    }
  });

  it('defaults to the small E5 model and rejects unknown names', () => {
    expect(createEmbedder(undefined).model).toBe('multilingual-e5-small');
    expect(() => createEmbedder('nope')).toThrow(/Unknown embedder "nope".*local-e5-base/);
  });

  it('gives every model a distinct name so embeddings never mix', () => {
    const names = Object.values(LOCAL_MODELS).map((m) => m.name);
    expect(new Set(names).size).toBe(names.length);
    expect(LOCAL_MODELS['local-e5-base']?.dimension).toBe(768);
    expect(LOCAL_MODELS['local-e5-large']?.prefix.query).toBe('query: ');
    expect(LOCAL_MODELS['local-bge-m3']?.prefix).toEqual({ query: '', passage: '' });
  });
});

describe('OverlapReranker', () => {
  it('scores passages by the share of question words they contain', async () => {
    const scores = await new OverlapReranker().score('Rechnung ausstellen Frist', [
      'Die Rechnung ist auszustellen',
      'Rechnung ausstellen Frist beachten',
      'Etwas ganz anderes',
    ]);
    expect(scores[1]).toBeGreaterThan(scores[0] ?? 1);
    expect(scores[0]).toBeGreaterThan(scores[2] ?? 1);
  });
});
