import { mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { strToU8, zipSync } from 'fflate';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GesetzeImInternetSource, USER_AGENT } from './gesetze-im-internet-source.js';

const xmlFor = (slug: string): Promise<string> =>
  readFile(join(import.meta.dirname, '../test/fixtures/statutes', `${slug}.xml`), 'utf-8');

describe('GesetzeImInternetSource', () => {
  let cacheDir: string;
  beforeEach(async () => {
    cacheDir = await mkdtemp(join(tmpdir(), 'nk-cache-'));
  });
  afterEach(async () => {
    await rm(cacheDir, { recursive: true, force: true });
  });

  function harness() {
    const events: string[] = [];
    const requests: { url: string; userAgent: string | null }[] = [];
    let inFlight = 0;
    let maxInFlight = 0;
    const fetchImpl: typeof fetch = async (input, init) => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const slug = /\/([^/]+)\/xml\.zip$/.exec(url)?.[1] ?? '';
      requests.push({ url, userAgent: new Headers(init?.headers).get('User-Agent') });
      events.push(`fetch:${slug}`);
      await Promise.resolve();
      const body = zipSync({ [`${slug}.xml`]: strToU8(await xmlFor(slug)) });
      inFlight--;
      return new Response(body, { status: 200 });
    };
    const sleep = (ms: number): Promise<void> => {
      events.push(`sleep:${ms}`);
      return Promise.resolve();
    };
    return { events, requests, fetchImpl, sleep, maxInFlight: () => maxInFlight };
  }

  const laws = [
    { slug: 'ustg_1980', title: 'Umsatzsteuergesetz' },
    { slug: 'ddg', title: 'Digitale-Dienste-Gesetz' },
  ];

  async function ingest(source: GesetzeImInternetSource) {
    const results = [];
    for await (const doc of source.loadDocuments()) results.push(source.split(doc));
    return results;
  }

  it('downloads one at a time, pauses between requests, and identifies the project', async () => {
    const h = harness();
    const source = new GesetzeImInternetSource({
      cacheDir,
      laws,
      pauseMs: 1234,
      fetchImpl: h.fetchImpl,
      sleep: h.sleep,
    });
    const results = await ingest(source);
    expect(results.map((r) => r.source)).toEqual(['UStG', 'DDG']);
    expect(h.events).toEqual(['fetch:ustg_1980', 'sleep:1234', 'fetch:ddg']);
    expect(h.maxInFlight()).toBe(1);
    expect(h.requests.map((r) => r.url)).toEqual([
      'https://www.gesetze-im-internet.de/ustg_1980/xml.zip',
      'https://www.gesetze-im-internet.de/ddg/xml.zip',
    ]);
    for (const r of h.requests) {
      expect(r.userAgent).toBe(USER_AGENT);
      expect(r.userAgent).toContain('https://github.com/sotream/normkompass');
    }
  });

  it('stores raw files in the cache directory', async () => {
    const h = harness();
    await ingest(
      new GesetzeImInternetSource({ cacheDir, laws, fetchImpl: h.fetchImpl, sleep: h.sleep }),
    );
    expect((await readdir(cacheDir)).sort()).toEqual(['ddg.xml', 'ustg_1980.xml']);
    expect((await stat(join(cacheDir, 'ddg.xml'))).size).toBeGreaterThan(0);
  });

  it('makes no network request on a second run with a populated cache', async () => {
    const first = harness();
    await ingest(
      new GesetzeImInternetSource({
        cacheDir,
        laws,
        fetchImpl: first.fetchImpl,
        sleep: first.sleep,
      }),
    );
    const second = harness();
    const results = await ingest(
      new GesetzeImInternetSource({
        cacheDir,
        laws,
        fetchImpl: second.fetchImpl,
        sleep: second.sleep,
      }),
    );
    expect(second.requests).toEqual([]);
    expect(second.events).toEqual([]);
    expect(results.every((r) => r.units.length > 0)).toBe(true);
  });

  it('downloads again when refresh is requested', async () => {
    const first = harness();
    await ingest(
      new GesetzeImInternetSource({
        cacheDir,
        laws,
        fetchImpl: first.fetchImpl,
        sleep: first.sleep,
      }),
    );
    const second = harness();
    await ingest(
      new GesetzeImInternetSource({
        cacheDir,
        laws,
        refresh: true,
        fetchImpl: second.fetchImpl,
        sleep: second.sleep,
      }),
    );
    expect(second.requests).toHaveLength(2);
  });

  it('fails loudly on an HTTP error and writes nothing to the cache', async () => {
    const source = new GesetzeImInternetSource({
      cacheDir,
      laws,
      fetchImpl: () => Promise.resolve(new Response('nope', { status: 503 })),
      sleep: () => Promise.resolve(),
    });
    await expect(ingest(source)).rejects.toThrow(/status 503/);
    expect(await readdir(cacheDir)).toEqual([]);
  });
});
