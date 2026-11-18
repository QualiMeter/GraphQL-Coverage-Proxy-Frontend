import {requestJson} from './client';
import {validGraphqlErrors,type GraphqlErrorInfo} from './graphqlErrors';

export type OperationType = 'query' | 'mutation' | 'subscription';
export type OperationOut = {
  operationKey: string; operationName: string | null; operationType: OperationType;
  requestCount: number; countedRequestCount: number; httpErrorCount: number; graphqlErrorCount: number;
  avgDurationMs: number | null; lastSeenAt: string;
  fields: {typeName: string; fieldName: string; hits: number}[];
};
export type RequestOut = {
  testExecutionId?: string | null;
  id: string; runId: string; operationName: string | null; operationType: string | null; operationKey?: string | null;
  httpMethod: string; httpStatus: number | null; analysisStatus: string; responseHasData: boolean | null;
  graphqlHasErrors: boolean | null; durationMs: number | null; errorCode: string | null; createdAt: string;
};
export type RequestDetail = RequestOut & GraphqlErrorInfo & {
  countedInCoverage: boolean; selectedFields: {typeName: string; fieldName: string; returnType: string | null}[];
  safeGraphqlDocument?: string | null; documentAvailability?: 'available' | 'redacted' | 'unavailable';
};
export type RunStats = {
  totalFields: number; coveredFields: number; coveragePercent: number;
  totalRequests: number; countedRequests: number; uniqueOperations: number;
  queryRequests: number; mutationRequests: number; subscriptionRequests: number;
  httpErrorCount: number; graphqlErrorCount: number; avgDurationMs: number | null; p95DurationMs?: number | null;
  analysisStatusCounts?: {success: number; parseError: number; validationError: number; unsupported: number; internalError: number};
  requestTimeline: {bucketStart: string; requestCount: number; countedRequestCount: number;
    httpErrorCount: number; graphqlErrorCount: number; avgDurationMs: number | null}[];
};

const object = (v: unknown): v is Record<string, unknown> => Boolean(v && typeof v === 'object' && !Array.isArray(v));
const strings = (v: Record<string, unknown>, ...keys: string[]) => keys.every(k => typeof v[k] === 'string');
const date = (value: unknown) => typeof value === 'string' && Number.isFinite(Date.parse(value));
const counts = (v: Record<string, unknown>, ...keys: string[]) => keys.every(k => Number.isInteger(v[k]) && Number(v[k]) >= 0);
const nullable = (v: unknown, type: 'string' | 'number' | 'boolean') => v === null || typeof v === type;
const path = (id: string) => `/api/runs/${encodeURIComponent(id)}` as const;
const field = (v: unknown): v is Record<string, unknown> => object(v) && strings(v, 'typeName', 'fieldName');
function requestRow(v: unknown, runId: string): v is RequestOut {
  return object(v) && v.runId === runId && strings(v, 'id', 'httpMethod', 'analysisStatus') && date(v.createdAt) &&
    ['operationName', 'operationType', 'errorCode'].every(key => nullable(v[key], 'string')) &&
    (v.operationKey === undefined || nullable(v.operationKey, 'string')) &&
    (v.testExecutionId === undefined || nullable(v.testExecutionId, 'string')) &&
    ['httpStatus', 'durationMs'].every(key => nullable(v[key], 'number')) &&
    ['responseHasData', 'graphqlHasErrors'].every(key => nullable(v[key], 'boolean'));
}

export function getOperations(runId: string, signal?: AbortSignal) {
  return requestJson(`${path(runId)}/operations`, data => {
    if (!Array.isArray(data) || !data.every(v => object(v) && strings(v, 'operationKey') && date(v.lastSeenAt) &&
      ['query', 'mutation', 'subscription'].includes(String(v.operationType)) && nullable(v.operationName, 'string') &&
      counts(v, 'requestCount', 'countedRequestCount', 'httpErrorCount', 'graphqlErrorCount') &&
      nullable(v.avgDurationMs, 'number') && Array.isArray(v.fields) && v.fields.every(f => field(f) && counts(f, 'hits')))) {
      throw new Error('Expected OperationOut[]');
    }
    return data as OperationOut[];
  }, {signal});
}

export function getRunStats(runId: string, signal?: AbortSignal) {
  return requestJson(`${path(runId)}/stats`, data => {
    if (!object(data) || !counts(data, 'totalRequests', 'countedRequests', 'uniqueOperations', 'queryRequests',
      'mutationRequests', 'subscriptionRequests', 'httpErrorCount', 'graphqlErrorCount', 'totalFields', 'coveredFields') ||
      !Number.isFinite(data.coveragePercent) || !nullable(data.avgDurationMs, 'number') || (data.p95DurationMs !== undefined && !nullable(data.p95DurationMs, 'number')) ||
      (data.analysisStatusCounts !== undefined && (!object(data.analysisStatusCounts) ||
        !counts(data.analysisStatusCounts, 'success', 'parseError', 'validationError', 'unsupported', 'internalError'))) ||
      !Array.isArray(data.requestTimeline) || !data.requestTimeline.every(bucket => object(bucket) &&
        date(bucket.bucketStart) && counts(bucket, 'requestCount', 'countedRequestCount', 'httpErrorCount', 'graphqlErrorCount') &&
        nullable(bucket.avgDurationMs, 'number'))) throw new Error('Expected RunStats');
    return data as RunStats;
  }, {signal});
}

export type JournalQuery = {
  testExecutionId?: string; operationName?: string; operationKey?: string; operationType?: string;
  typeName?: string; fieldName?: string; graphqlHasErrors?: boolean; httpStatusClass?: number; httpStatus?: number;
  analysisStatus?: string; from?: string; to?: string; sortBy: 'createdAt' | 'durationMs'; sortOrder?: 'asc' | 'desc';
};
export const journalPageSize = 50;

export function getJournal(runId: string, query: JournalQuery, offset: number, signal?: AbortSignal,
  {limit=journalPageSize,includeTotal=false}:{limit?:number;includeTotal?:boolean}={}) {
  const params = new URLSearchParams({limit: String(limit), offset: String(offset)});
  for (const [key, value] of Object.entries(query)) if (value !== undefined) params.set(key, String(value));
  return requestJson(`${path(runId)}/requests?${params}`, (data, response) => {
    if (!Array.isArray(data) || !data.every(item => requestRow(item, runId))) throw new Error('Expected RequestOut[]');
    const total = response.headers.get('X-Total-Count');
    return {rows: data as RequestOut[], more: total !== null && /^\d+$/.test(total)
      ? offset + data.length < Number(total) : data.length === limit,
      ...(includeTotal&&total!==null&&/^\d+$/.test(total)?{total:Number(total)}:{})};
  }, {signal});
}

export function getRequestDetail(runId: string, requestId: string, signal?: AbortSignal) {
  return requestJson(`${path(runId)}/requests/${encodeURIComponent(requestId)}`, data => {
    if (!object(data) || !requestRow(data, runId) || data.id !== requestId ||
      !('countedInCoverage' in data) || typeof data.countedInCoverage !== 'boolean' ||
      !('selectedFields' in data) || !Array.isArray(data.selectedFields) ||
      !data.selectedFields.every(v => field(v) && nullable(v.returnType, 'string')) ||
      ('safeGraphqlDocument' in data && !nullable(data.safeGraphqlDocument, 'string')) ||
      ('documentAvailability' in data && !['available','redacted','unavailable'].includes(String(data.documentAvailability))) || !validGraphqlErrors(data)) {
      throw new Error('Expected RequestDetailOut');
    }
    return data as RequestDetail;
  }, {signal});
}

export async function getFilteredJournal(runId: string, query: JournalQuery, offset: number,
  group: 'http' | 'analyzer' | '', signal?: AbortSignal) {
  if (!group) return getJournal(runId, query, offset, signal);
  const variants: JournalQuery[] = group === 'http'
    ? [4, 5].map(httpStatusClass => ({...query, httpStatusClass}))
    : ['parse_error', 'validation_error', 'internal_error'].map(analysisStatus => ({...query, analysisStatus}));
  const end = offset + journalPageSize;
  const groups = await Promise.all(variants.map(async variant => {
    const rows: RequestOut[] = [];
    let cursor = 0;
    let more = true;
    while (more && rows.length < end) {
      const page = await getJournal(runId, variant, cursor, signal);
      rows.push(...page.rows);
      more = page.more && page.rows.length > 0;
      cursor += page.rows.length;
    }
    return {rows, more};
  }));
  const sorted = groups.flatMap(group => group.rows).sort((a, b) => {
    if (query.sortBy === 'durationMs' && a.durationMs !== b.durationMs) {
      if (a.durationMs === null) return 1;
      if (b.durationMs === null) return -1;
      return (b.durationMs - a.durationMs) * (query.sortOrder === 'asc' ? -1 : 1);
    }
    const order = query.sortBy === 'createdAt' ? Date.parse(b.createdAt) - Date.parse(a.createdAt) : 0;
    return (order || b.id.localeCompare(a.id)) * (query.sortOrder === 'asc' ? -1 : 1);
  });
  return {rows: sorted.slice(offset, end), more: sorted.length > end || groups.some(group => group.more)};
}
