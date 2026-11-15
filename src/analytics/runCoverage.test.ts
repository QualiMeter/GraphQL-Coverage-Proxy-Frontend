import {afterEach, describe, expect, it, vi} from 'vitest';
import {getRunCoverage, getSchemaGraph, type RunCoverageGraph} from '../api/schemas';
import {schemaGraphTypes} from './backendSchema';
import {coverageErrorMessage, coverageForRequest} from './useRunCoverage';
import {relationsFor} from './schemaInvestigation';
import {graphEdges, layout} from '../graph/transform';
import {coverageRows, defaultAdvancedFilters, filterCoverageRows} from './coverageTableFilters';
import {ApiError} from '../api/client';

const schemaId = '00000000-0000-4000-8000-000000000020';
const runId = '00000000-0000-4000-8000-000000000030';
const edgeId = '00000000-0000-4000-8000-000000000040';
const initial: RunCoverageGraph = {
  schemaId, runId, summary: {totalFields: 2, coveredFields: 0, coveragePercent: 0},
  rootTypes: {query: 'RootQuery'},
  types: [
    {name: 'RootQuery', kind: 'OBJECT', totalFields: 1, coveredFields: 0, coveragePercent: 0, fields: [
      {name: 'viewer', returnType: 'User!', targetType: 'User', deprecated: true, covered: false, hits: 0},
    ]},
    {name: 'User', kind: 'OBJECT', totalFields: 1, coveredFields: 0, coveragePercent: 0, fields: [
      {name: 'name', returnType: 'String', targetType: null, deprecated: false, covered: false, hits: 0},
    ]},
    {name: 'Empty', kind: 'OBJECT', totalFields: 0, coveredFields: 0, coveragePercent: null, fields: []},
  ],
  relations: [{id: edgeId, fromType: 'RootQuery', field: 'viewer', toType: 'User', covered: false}],
};

const updated: RunCoverageGraph = {
  ...initial, summary: {...initial.summary, coveredFields: 1, coveragePercent: 50},
  types: initial.types.map(type => type.name === 'RootQuery' ? {
    ...type, coveredFields: 1, coveragePercent: 100,
    fields: type.fields.map(field => ({...field, covered: true, hits: 7})),
  } : type),
  relations: initial.relations.map(edge => ({...edge, covered: true})),
};
afterEach(() => vi.unstubAllGlobals());

describe('coverage of the selected backend run', () => {
  it('uses the real GET and displays zero hits and percentages from a measured run', async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json(initial));
    vi.stubGlobal('fetch', fetch);
    const {signal} = new AbortController();
    const data = await getRunCoverage(runId, schemaId, signal);
    expect(fetch).toHaveBeenCalledExactlyOnceWith(`/api/runs/${runId}/coverage`, expect.objectContaining({
      method: 'GET', credentials: 'same-origin', signal,
    }));
    expect(data.summary).toEqual({totalFields: 2, coveredFields: 0, coveragePercent: 0});
    const types = schemaGraphTypes(data);
    expect(types[0]).toMatchObject({name: 'RootQuery', role: 'query', coveredFields: 0, coveragePercent: 0,
      fields: [{name: 'viewer', covered: false, hits: 0, returnType: 'User!', deprecated: true}]});
    expect(types[2].coveragePercent).toBeNull();
    expect(graphEdges({types})[0]).toMatchObject({id: edgeId, covered: false});
  });

  it('updates hits and edge coverage without changing geometry or relation IDs', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(Response.json(initial)).mockResolvedValueOnce(Response.json(updated)));
    const before = schemaGraphTypes(await getRunCoverage(runId, schemaId));
    const afterData = await getRunCoverage(runId, schemaId);
    const after = schemaGraphTypes(afterData);
    expect(afterData.summary.coveragePercent).toBe(50);
    expect(layout({types: after})).toEqual(layout({types: before}));
    expect(graphEdges({types: after})[0]).toMatchObject({id: edgeId, source: 'RootQuery', target: 'User', covered: true});
    expect(relationsFor(after)[0]).toMatchObject({id: edgeId, covered: true});
    expect(filterCoverageRows(coverageRows(after), {
      ...defaultAdvancedFilters, hits: 'medium', coverage: 'covered', search: '', type: '',
    }, 'hits').map(row => [row.id, row.field.hits])).toEqual([['RootQuery.viewer', 7]]);
  });

  it('keeps same-run data while refreshing but hides it on run, schema or service change', () => {
    const prior = {scope: 'run-a', request: 'initial', data: initial, error: null};
    expect(coverageForRequest(prior, 'run-a', 'refresh')).toEqual({data: initial, loading: true, error: null});
    expect(coverageForRequest(prior, 'run-b', 'initial')).toEqual({data: null, loading: true, error: null});
    expect(coverageForRequest(prior, null, 'initial')).toEqual({data: null, loading: false, error: null});
    const denied = new ApiError('http', 'Недостаточно прав.', 403);
    expect(coverageForRequest({...prior, request: 'refresh', data: null, error: denied}, 'run-a', 'refresh'))
      .toEqual({data: null, loading: false, error: denied});
  });

  it('treats structural graph zeros as missing metrics when there is no run', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({...initial, runId: null})));
    const types = schemaGraphTypes(await getSchemaGraph(schemaId));
    expect(types[0]).toMatchObject({coveragePercent: null, coveredFields: null, fields: [{hits: null, covered: null}]});
    expect(graphEdges({types})[0].covered).toBeUndefined();
  });

  it.each([401, 403, 404])('reports HTTP %s without any fallback data', async status => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, {status})));
    const error = await getRunCoverage(runId, schemaId).catch((error: ApiError) => error);
    expect(error).toMatchObject({kind: 'http', status});
    if (error instanceof ApiError && status === 404) expect(coverageErrorMessage(error)).toContain('Прогон не найден');
  });

  it.each([{runId: 'stale-run'}, {schemaId: 'wrong-snapshot'}, {summary: {...initial.summary, coveragePercent: null}}])(
    'rejects mismatched or unmeasured run responses', async override => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({...initial, ...override})));
      await expect(getRunCoverage(runId, schemaId)).rejects.toMatchObject({kind: 'invalid-response'});
    },
  );
});
