import {requestJson} from './client';
import {isRunCi,type RunCi} from './runCi';

export type RunOut = {
  ci?:RunCi|null;
  id: string;
  snapshotId: string;
  name: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
};

export type RunScope = {serviceId: string; snapshotId?: never} | {snapshotId: string; serviceId?: never};
export type RunQuery={status?:'running'|'completed'|'failed';branch?:string;commitSha?:string;environment?:string;pipelineId?:string;pipelineStatus?:string;jobId?:string;jobName?:string;jobStatus?:string;from?:string;to?:string;sortBy?:'startedAt'|'branch'|'commitSha'|'environment'|'pipelineId'|'pipelineStatus'|'jobId'|'jobName';sortOrder?:'asc'|'desc';limit?:number};
export type RunPage = {runs: RunOut[]; hasMore: boolean;total?:number|null};
export const runPageSize = 50;

const uuid = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const isId = (value: unknown): value is string => typeof value === 'string' && uuid.test(value);
const isDate = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value));

function decodeRun(data: unknown): RunOut {
  if (data && typeof data === 'object') {
    const {id, snapshotId, name, status, startedAt, finishedAt} = data as Record<string, unknown>;
    if (isId(id) && isId(snapshotId) && typeof name === 'string' && typeof status === 'string' &&
        isDate(startedAt) && (finishedAt === null || isDate(finishedAt))) {
      const ci=(data as Record<string,unknown>).ci;
      if(ci!==undefined&&ci!==null&&!isRunCi(ci))throw new Error('Expected RunCiOut');
      return {id, snapshotId, name, status, startedAt, finishedAt,...(ci!==undefined?{ci:ci as RunCi|null}:{})};
    }
  }
  throw new Error('Expected RunOut');
}

export function listRuns(scope: RunScope, offset = 0, signal?: AbortSignal,
  {limit = runPageSize,...query}: RunQuery = {}) {
  if(!Number.isSafeInteger(offset)||offset<0||!Number.isSafeInteger(limit)||limit<1||limit>500)throw new Error('Некорректная страница прогонов.');
  const params = new URLSearchParams({limit: String(limit), offset: String(offset)});
  for(const [key,value] of Object.entries(query))if(value!==undefined&&value!=='')params.set(key,String(value));
  if (scope.snapshotId !== undefined) params.set('snapshotId', scope.snapshotId);
  else params.set('serviceId', scope.serviceId);
  return requestJson(`/api/runs?${params}`, (data, response): RunPage => {
    if (!Array.isArray(data)) throw new Error('Expected RunOut[]');
    const runs = data.map(decodeRun);
    if (scope.snapshotId && runs.some(run => run.snapshotId !== scope.snapshotId)) {
      throw new Error('Run does not belong to the requested snapshot');
    }
    const header = response.headers.get('X-Total-Count');
    const total=header!==null&&/^\d+$/.test(header)&&Number.isSafeInteger(Number(header))?Number(header):null;
    return {runs,total,hasMore:total!==null?offset+runs.length<total:runs.length===limit};
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
