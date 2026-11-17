import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/reader.js';

const runsDir = fileURLToPath(new URL('../runs/', import.meta.url));

describe('readNight', () => {
  it('groups the fixture into five jobs and counts its malformed line', () => {
    const digest = readNight(runsDir, '2026-10-28');

    expect(digest.malformedLines).toBe(1);
    expect(digest.rows).toHaveLength(5);
    expect(digest.rows.map(({ job }) => job)).toEqual([
      'rig/rotate-logs',
      'lane/sync',
      'fixtures/refresh',
      'notes/backup',
      'digest/render',
    ]);
  });

  it('preserves a null owner and aggregates attempts, retries, and times', () => {
    const { rows } = readNight(runsDir, '2026-10-28');
    const render = rows.find(({ job }) => job === 'digest/render');
    const refresh = rows.find(({ job }) => job === 'fixtures/refresh');

    expect(render).toMatchObject({
      owner: null,
      runs: 1,
      retries: 0,
      lastStatus: 'ok',
      firstAt: '2026-10-29T05:41:09+01:00',
      lastAt: '2026-10-29T05:41:09+01:00',
    });
    expect(refresh).toMatchObject({
      owner: 'rook',
      runs: 4,
      retries: 3,
      lastStatus: 'ok',
      lastError: 'upstream 503',
      firstAt: '2026-10-29T01:30:00+01:00',
      lastAt: '2026-10-29T01:37:00+01:00',
    });
  });
});
