import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, NightDigest, ReadNight } from './types.js';

type RunEvent = {
  at: string;
  job: string;
  status: DigestRow['lastStatus'];
  owner: string | null;
  error?: string;
};

function isRunEvent(value: unknown): value is RunEvent {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;

  const event = value as Record<string, unknown>;
  return (
    typeof event.at === 'string' &&
    event.at.length > 0 &&
    typeof event.job === 'string' &&
    event.job.length > 0 &&
    (event.status === 'ok' || event.status === 'retry' || event.status === 'fail') &&
    (typeof event.owner === 'string' || event.owner === null) &&
    (event.error === undefined || typeof event.error === 'string')
  );
}

export const readNight: ReadNight = (runsDir, night): NightDigest => {
  const contents = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  const lines = contents.length === 0 ? [] : contents.split(/\r?\n/);
  if (lines.at(-1) === '') lines.pop();

  const rowsByJob = new Map<string, DigestRow>();
  let malformedLines = 0;

  for (const line of lines) {
    let value: unknown;
    try {
      value = JSON.parse(line);
    } catch {
      malformedLines += 1;
      continue;
    }

    if (!isRunEvent(value)) {
      malformedLines += 1;
      continue;
    }

    const existing = rowsByJob.get(value.job);
    if (existing) {
      existing.owner = value.owner;
      existing.runs += 1;
      existing.retries += value.status === 'retry' ? 1 : 0;
      existing.lastStatus = value.status;
      existing.lastAt = value.at;
      if (value.error !== undefined) existing.lastError = value.error;
      continue;
    }

    rowsByJob.set(value.job, {
      job: value.job,
      owner: value.owner,
      runs: 1,
      retries: value.status === 'retry' ? 1 : 0,
      lastStatus: value.status,
      lastError: value.error ?? null,
      firstAt: value.at,
      lastAt: value.at,
    });
  }

  return { rows: [...rowsByJob.values()], malformedLines };
};
