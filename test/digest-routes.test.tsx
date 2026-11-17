import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const night = '2026-11-17';
const config = (runsDir: string) => ({
  adapter: 'shim',
  installed: '2026-10-29T14:06:00+01:00',
  beatEverySeconds: 60,
  runsDir,
});

const runsDirs: string[] = [];

function createRunsDir() {
  const runsDir = mkdtempSync(join(tmpdir(), 'rig-digest-routes-'));
  runsDirs.push(runsDir);
  return runsDir;
}

afterEach(() => {
  for (const runsDir of runsDirs.splice(0)) {
    rmSync(runsDir, { recursive: true, force: true });
  }
});

describe('digest routes', () => {
  it('serves a digest page and JSON for an existing night', async () => {
    const runsDir = createRunsDir();
    writeFileSync(
      join(runsDir, `${night}.jsonl`),
      `${JSON.stringify({
        at: '2026-11-17T05:00:00+01:00',
        job: 'lane/sync',
        status: 'ok',
        owner: 'rook',
      })}\n`,
    );
    const app = createApp(config(runsDir));

    const page = await app.request(`/digest/${night}`);
    const html = await page.text();
    expect(page.status).toBe(200);
    expect(html).toContain('lane/sync');

    const api = await app.request(`/api/digest/${night}`);
    expect(api.status).toBe(200);
    expect(await api.json()).toEqual({
      rows: [
        {
          job: 'lane/sync',
          owner: 'rook',
          runs: 1,
          retries: 0,
          lastStatus: 'ok',
          lastError: null,
          firstAt: '2026-11-17T05:00:00+01:00',
          lastAt: '2026-11-17T05:00:00+01:00',
        },
      ],
      malformedLines: 0,
    });
  });

  it('returns 404 from both routes when the night file is missing', async () => {
    const app = createApp(config(createRunsDir()));

    const page = await app.request(`/digest/${night}`);
    const api = await app.request(`/api/digest/${night}`);

    expect(page.status).toBe(404);
    expect(api.status).toBe(404);
  });

  it('renders an empty night and returns no rows in the JSON API', async () => {
    const runsDir = createRunsDir();
    writeFileSync(join(runsDir, `${night}.jsonl`), '');
    const app = createApp(config(runsDir));

    const page = await app.request(`/digest/${night}`);
    expect(page.status).toBe(200);
    expect(await page.text()).toContain('nothing ran');

    const api = await app.request(`/api/digest/${night}`);
    expect(api.status).toBe(200);
    expect(await api.json()).toEqual({ rows: [], malformedLines: 0 });
  });

  it('serves valid rows when a night contains a malformed line', async () => {
    const runsDir = createRunsDir();
    writeFileSync(
      join(runsDir, `${night}.jsonl`),
      [
        '{not json}',
        JSON.stringify({
          at: '2026-11-17T05:00:00+01:00',
          job: 'lane/sync',
          status: 'fail',
          owner: null,
          error: 'upstream unavailable',
        }),
        '',
      ].join('\n'),
    );
    const app = createApp(config(runsDir));

    const page = await app.request(`/digest/${night}`);
    expect(page.status).toBe(200);
    expect(await page.text()).toContain('lane/sync');

    const api = await app.request(`/api/digest/${night}`);
    expect(api.status).toBe(200);
    expect(await api.json()).toEqual({
      rows: [
        {
          job: 'lane/sync',
          owner: null,
          runs: 1,
          retries: 0,
          lastStatus: 'fail',
          lastError: 'upstream unavailable',
          firstAt: '2026-11-17T05:00:00+01:00',
          lastAt: '2026-11-17T05:00:00+01:00',
        },
      ],
      malformedLines: 1,
    });
  });
});
