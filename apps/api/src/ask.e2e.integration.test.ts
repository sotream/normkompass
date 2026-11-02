import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  ScriptedModel,
  answerFromFirstSource,
  type AnswerModel,
  type AnswerResponse,
} from '@normkompass/answer';
import {
  DATABASE_URL,
  HashingEmbedder,
  HybridSearch,
  createTestDb,
  fixtureUnits,
  indexUnits,
  type Pool,
} from '@normkompass/search';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AskController } from './ask.controller.js';
import { ASK_SERVICE, PipelineAskService } from './ask.service.js';

/** End to end: HTTP -> Postgres retrieval (fake embedder) -> scripted model -> code verification. */
describe.skipIf(!DATABASE_URL)('POST /ask end to end (Postgres, scripted model)', () => {
  let pool: Pool;
  let emptyPool: Pool;
  let dropAll: () => Promise<void>;
  const embedder = new HashingEmbedder();
  const QUESTION = 'Was ist eine elektronische Rechnung?';

  beforeAll(async () => {
    const db = await createTestDb();
    const empty = await createTestDb();
    pool = db.pool;
    emptyPool = empty.pool;
    dropAll = async () => {
      await db.drop();
      await empty.drop();
    };
    await indexUnits(pool, embedder, fixtureUnits());
  });
  afterAll(async () => {
    await dropAll();
  });

  async function appWith(model: AnswerModel, db: Pool = pool): Promise<INestApplication> {
    const hybrid = new HybridSearch(db, embedder);
    const service = new PipelineAskService(
      { search: (q, limit) => hybrid.search(q, { limit }) },
      () => model,
    );
    const moduleRef = await Test.createTestingModule({
      controllers: [AskController],
      providers: [{ provide: ASK_SERVICE, useValue: service }],
    }).compile();
    const app = moduleRef.createNestApplication();
    await app.init();
    return app;
  }

  const ask = async (app: INestApplication): Promise<AnswerResponse> =>
    (await request(app.getHttpServer()).post('/ask').send({ question: QUESTION }))
      .body as AnswerResponse;

  it('returns a verified answer whose citations match stored chunks', async () => {
    const app = await appWith(new ScriptedModel(({ sources }) => answerFromFirstSource(sources)));
    const body = await ask(app);
    await app.close();

    expect(body.refused).toBe(false);
    expect(body.answer).not.toBe('');
    expect(body.stand).toMatch(/: zuletzt geändert|: Zuletzt geändert/i);
    expect(body.citations.length).toBeGreaterThan(0);
    for (const c of body.citations) {
      const row = (
        await pool.query<{ text: string; url: string; source: string; path: string[] }>(
          'SELECT text, url, source, path FROM chunks WHERE url = $1 AND source = $2 AND text LIKE $3',
          [c.url, c.source, `%${c.quote.replace(/[\\%_]/g, '\\$&')}%`],
        )
      ).rows.find((r) => r.path.join(' ') === c.path);
      expect(row, `no stored chunk contains the quote of ${c.path}`).toBeDefined();
      expect(row?.text.includes(c.quote)).toBe(true);
    }
  });

  it('refuses when the model invents a quote', async () => {
    const app = await appWith(
      new ScriptedModel(() =>
        JSON.stringify({
          refused: false,
          answer: 'Erfunden.',
          citations: [{ chunk: 1, quote: 'Dieser Satz steht in keinem Gesetz.' }],
        }),
      ),
    );
    const body = await ask(app);
    await app.close();
    expect(body).toEqual({ answer: '', citations: [], refused: true, stand: null });
  });

  it('refuses when one citation among valid ones is invented', async () => {
    const app = await appWith(
      new ScriptedModel(({ sources }) => {
        const first = sources[0];
        return JSON.stringify({
          refused: false,
          answer: 'Teilweise erfunden.',
          citations: [
            { chunk: 1, quote: first?.hit.text.slice(0, 40) ?? 'x' },
            { chunk: 1, quote: 'nicht im Text enthalten' },
          ],
        });
      }),
    );
    const body = await ask(app);
    await app.close();
    expect(body.refused).toBe(true);
    expect(body.citations).toEqual([]);
  });

  it('refuses when the model refuses', async () => {
    const app = await appWith(
      new ScriptedModel(() => '{"refused":true,"answer":"","citations":[]}'),
    );
    const body = await ask(app);
    await app.close();
    expect(body).toEqual({ answer: '', citations: [], refused: true, stand: null });
  });

  it('refuses without calling the model when the index returns nothing', async () => {
    const model = new ScriptedModel(({ sources }) => answerFromFirstSource(sources));
    const app = await appWith(model, emptyPool);
    const body = await ask(app);
    await app.close();
    expect(body).toEqual({ answer: '', citations: [], refused: true, stand: null });
    expect(model.calls).toBe(0);
  });

  it('refuses when the model call fails and does not leak the error', async () => {
    const app = await appWith(
      new ScriptedModel(() => {
        throw new Error('upstream failure with secret');
      }),
    );
    const res = await request(app.getHttpServer()).post('/ask').send({ question: QUESTION });
    await app.close();
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).not.toContain('secret');
    expect((res.body as AnswerResponse).refused).toBe(true);
  });
});
