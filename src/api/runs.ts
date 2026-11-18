import {requestJson} from './client';

export type RunOut = {
  id: string;
  snapshotId: string;
  name: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
};

type RunScope = {serviceId: string; snapshotId?: never} | {snapshotId: string; serviceId?: never};
export type RunPage = {runs: RunOut[]; hasMore: boolean};
export const runPageSize = 50;

const uuid = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const isId = (value: unknown): value is string => typeof value === 'string' && uuid.test(value);
const isDate = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value));

function decodeRun(data: unknown): RunOut {
  if (data && typeof data === 'object') {
    const {id, snapshotId, name, status, startedAt, finishedAt} = data as Record<string, unknown>;
    if (isId(id) && isId(snapshotId) && typeof name === 'string' && typeof status === 'string' &&
        isDate(startedAt) && (finishedAt === null || isDate(finishedAt))) {
      return {id, snapshotId, name, status, startedAt, finishedAt};
    }
  }
  throw new Error('Expected RunOut');
}

export function listRuns(scope: RunScope, offset = 0, signal?: AbortSignal,
  {status, limit = runPageSize}: {status?: 'running' | 'completed'; limit?: number} = {}) {
  const params = new URLSearchParams({limit: String(limit), offset: String(offset)});
  if (status) params.set('status', status);
  if (scope.snapshotId !== undefined) params.set('snapshotId', scope.snapshotId);
  else params.set('serviceId', scope.serviceId);
  return requestJson(`/api/runs?${params}`, (data, response): RunPage => {
    if (!Array.isArray(data)) throw new Error('Expected RunOut[]');
    const runs = data.map(decodeRun);
    if (scope.snapshotId && runs.some(run => run.snapshotId !== scope.snapshotId)) {
      throw new Error('Run does not belong to the requested snapshot');
    }
    const total = response.headers.get('X-Total-Count');
    return {runs, hasMore: total !== null && /^\d+$/.test(total) ? offset + runs.length < Number(total) : runs.length === limit};
  }, {signal});
}

export async function hasActiveRun(serviceId: string, signal: AbortSignal) {
  const {runs} = await listRuns({serviceId}, 0, signal, {status: 'running', limit: 1});
  return runs.some(run => run.status === 'running');
}

export function createRun(snapshotId: string, name: string, csrfToken: string) {
  return requestJson('/api/runs', data => {
    const run = decodeRun(data);
    if (run.snapshotId !== snapshotId || run.status !== 'running') throw new Error('Unexpected created run');
    return run;
  }, {method: 'POST', body: {snapshotId, name}, csrfToken});
}

export function finishRun(run: RunOut, csrfToken: string) {
  return requestJson(`/api/runs/${encodeURIComponent(run.id)}/finish`, data => {
    const finished = decodeRun(data);
    if (finished.id !== run.id || finished.snapshotId !== run.snapshotId || finished.status !== 'completed') {
      throw new Error('Unexpected finished run');
    }
    return finished;
  }, {method: 'POST', csrfToken});
}

export async function findRun(snapshotId: string, runId: string, signal?: AbortSignal): Promise<RunOut | null> {
  for (let offset = 0; ; offset += runPageSize) {
    const page = await listRuns({snapshotId}, offset, signal);
    const match = page.runs.find(run => run.id === runId);
    if (match || !page.hasMore || !page.runs.length) return match ?? null;
  }
}
