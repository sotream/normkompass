import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigurationError, type AnswerResponse } from '@normkompass/answer';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { AskController } from './ask.controller.js';
import { ASK_SERVICE, type AskPort } from './ask.service.js';

const ANSWER: AnswerResponse = {
  answer: 'Eine Rechnung ist ein Dokument.',
  citations: [
    {
      source: 'UStG',
      path: '§ 14 Abs. 1',
      url: 'https://www.gesetze-im-internet.de/ustg_1980/__14.html',
      quote: 'Rechnung ist jedes Dokument',
    },
  ],
  refused: false,
  stand: 'UStG: Stand X',
};

describe('POST /ask', () => {
  let app: INestApplication;
  const ask = vi.fn<AskPort['ask']>(() => Promise.resolve(ANSWER));

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AskController],
      providers: [{ provide: ASK_SERVICE, useValue: { ask } }],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });

  it('returns the answer shape with citations and stand', async () => {
    const res = await request(app.getHttpServer())
      .post('/ask')
      .send({ question: '  Was ist eine Rechnung?  ' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(ANSWER);
    expect(ask).toHaveBeenLastCalledWith('Was ist eine Rechnung?');
  });

  it.each([
    ['empty question', { question: '' }],
    ['blank question', { question: '  ' }],
    ['missing question', {}],
    ['non-string question', { question: 7 }],
    ['too long question', { question: 'x'.repeat(1001) }],
  ])('rejects %s with 400', async (_name, body) => {
    ask.mockClear();
    const res = await request(app.getHttpServer()).post('/ask').send(body);
    expect(res.status).toBe(400);
    expect(ask).not.toHaveBeenCalled();
  });

  it('answers 503 with the configuration error when the model is not configured', async () => {
    ask.mockRejectedValueOnce(
      new ConfigurationError('Answer generation is not configured: set ANSWER_MODEL'),
    );
    const res = await request(app.getHttpServer()).post('/ask').send({ question: 'Frage?' });
    expect(res.status).toBe(503);
    expect((res.body as { message: string }).message).toMatch(/set ANSWER_MODEL/);
  });

  it('does not leak other errors', async () => {
    ask.mockRejectedValueOnce(new Error('connection string postgres://secret'));
    const res = await request(app.getHttpServer()).post('/ask').send({ question: 'Frage?' });
    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toContain('secret');
  });
});
