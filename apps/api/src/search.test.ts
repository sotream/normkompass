import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { SearchHit } from '@normkompass/search';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { SearchController } from './search.controller.js';
import { SEARCH_SERVICE, type SearchPort } from './search.service.js';

const hit = (n: number): SearchHit => ({
  chunkId: `ustg_1980/§ 14/Abs. ${n}#1`,
  unitId: `ustg_1980/§ 14/Abs. ${n}`,
  part: 1,
  source: 'UStG',
  path: ['§ 14', `Abs. ${n}`],
  label: `§ 14 Abs. ${n} UStG`,
  title: 'Ausstellung von Rechnungen',
  url: 'https://www.gesetze-im-internet.de/ustg_1980/__14.html',
  stand: 'Stand X',
  text: `(${n}) Text`,
  score: 0.03,
  vectorRank: n,
  ftsRank: null,
});

describe('POST /search', () => {
  let app: INestApplication;
  const search = vi.fn<SearchPort['search']>((_q, limit) =>
    Promise.resolve([1, 2, 3, 4, 5, 6, 7, 8].slice(0, limit).map(hit)),
  );

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [SearchController],
      providers: [{ provide: SEARCH_SERVICE, useValue: { search } }],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });

  it('returns at most the requested number of ranked chunks', async () => {
    const res = await request(app.getHttpServer())
      .post('/search')
      .send({ question: ' Wann ist eine Rechnung auszustellen? ', limit: 3 });
    expect(res.status).toBe(200);
    const body = res.body as { results: SearchHit[] };
    expect(body.results).toHaveLength(3);
    expect(body.results[0]).toMatchObject({ label: '§ 14 Abs. 1 UStG', stand: 'Stand X' });
    expect(search).toHaveBeenLastCalledWith('Wann ist eine Rechnung auszustellen?', 3);
  });

  it('uses a default limit', async () => {
    const res = await request(app.getHttpServer()).post('/search').send({ question: 'Rechnung' });
    expect(res.status).toBe(200);
    expect((res.body as { results: unknown[] }).results).toHaveLength(5);
  });

  it.each([
    ['empty question', { question: '' }],
    ['blank question', { question: '   ' }],
    ['missing question', {}],
    ['non-string question', { question: 42 }],
    ['too long question', { question: 'x'.repeat(1001) }],
    ['zero limit', { question: 'a', limit: 0 }],
    ['fractional limit', { question: 'a', limit: 1.5 }],
    ['excessive limit', { question: 'a', limit: 21 }],
    ['string limit', { question: 'a', limit: '3' }],
  ])('rejects %s with 400', async (_name, body) => {
    const res = await request(app.getHttpServer()).post('/search').send(body);
    expect(res.status).toBe(400);
  });
});
