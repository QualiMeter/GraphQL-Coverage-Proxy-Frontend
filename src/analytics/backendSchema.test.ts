import {afterEach, describe, expect, it, vi} from 'vitest';
import {getSchemaGraph, getSchemaSdl, listSchemas, type CoverageGraph} from '../api/schemas';
import {graphEdges, layout} from '../graph/transform';
import {schemaGraphTypes, snapshotOption} from './backendSchema';
import {explorerResults} from './explorer';
import {relationsFor} from './schemaInvestigation';
import {resourceForScope} from './useBackendSchema';

const serviceId = '85148c00-ced9-40f4-99f3-4a245ef9ca10';
const schemaId = '059c02de-e7f7-47ab-8b2e-21aac40d7f2c';
const snapshot = {id: schemaId, serviceId, schemaHash: 'ab39f14834e90', source: 'sdl', createdAt: '2026-11-14T09:34:40Z'};
const graph: CoverageGraph = {
  schemaId, runId: null, summary: {totalFields: 1, coveredFields: 0, coveragePercent: 0},
  rootTypes: {query: 'Storefront', subscription: 'Events'},
  types: [
    {name: 'Storefront', kind: 'OBJECT', totalFields: 1, coveredFields: 0, coveragePercent: 0, fields: [
      {name: 'orders', returnType: '[Order!]!', targetType: 'Order', deprecated: true, covered: false, hits: 0,
        description: 'Recent orders', deprecationReason: 'Use purchases', args: [{name: 'limit', type: 'Int'}]},
    ]},
    {name: 'Order', kind: 'OBJECT', totalFields: 0, coveredFields: 0, coveragePercent: null, fields: []},
    {name: 'Events', kind: 'OBJECT', totalFields: 0, coveredFields: 0, coveragePercent: null, fields: []},
  ],
  relations: [{id: 'ba6b9662-8f37-546b-b1f6-21a3411147c6', fromType: 'Storefront', field: 'orders', toType: 'Order', covered: false}],
};
afterEach(() => vi.unstubAllGlobals());

describe('backend snapshots and graph', () => {
  it('requests snapshots for the selected service, preserving a valid empty response', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(Response.json([snapshot])).mockResolvedValueOnce(Response.json([]));
    vi.stubGlobal('fetch', fetch);
    const {signal} = new AbortController();
    await expect(listSchemas(serviceId, signal)).resolves.toEqual([snapshot]);
    expect(fetch).toHaveBeenCalledWith(`/api/schemas?serviceId=${serviceId}`, expect.objectContaining({signal, credentials: 'same-origin'}));
    await expect(listSchemas(serviceId)).resolves.toEqual([]);
    expect(snapshotOption({...snapshot, displayName: 'Store API'}).name).toBe('Store API');
    expect(snapshotOption(snapshot).name).toBe('Снимок ab39f148');
  });

  it('uses graph roots, field metadata and relation IDs, with no metrics without a run', async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json(graph));
    vi.stubGlobal('fetch', fetch);
    const types = schemaGraphTypes(await getSchemaGraph(schemaId));

    expect(fetch).toHaveBeenCalledWith(`/api/schemas/${schemaId}/graph`, expect.anything());
    expect(types[0]).toMatchObject({
      role: 'query', coveragePercent: null, coveredFields: null,
      fields: [{name: 'orders', returnType: '[Order!]!', covered: null, hits: null, targetType: 'Order',
        args: [{name: 'limit', type: 'Int'}], deprecationReason: 'Use purchases'}],
    });
    const [edge] = graphEdges({types});
    expect(edge).toMatchObject({id: graph.relations[0].id, source: 'Storefront', sourceHandle: 'field:Storefront.orders', target: 'Order'});
    expect(relationsFor(types)[0].id).toBe(edge.id);
    expect(layout({types}).find(type => type.id === 'Events')?.position.x).toBe(0);
    expect(explorerResults(types, '', 'all', 'name', 'subscription').map(item => item.type.name)).toEqual(['Events']);
    expect(explorerResults(types, '', 'zero', 'name', 'all')).toEqual([]);
  });

  it('discards the previous service, snapshot or permission scope while fetching', () => {
    const prior = {key: 'shop:1', state: {kind: 'ready' as const, data: [snapshot]}};
    expect(resourceForScope(prior, 'shop:1')).toEqual(prior.state);
    expect(resourceForScope(prior, 'other-service:2')).toEqual({kind: 'loading'});
    expect(resourceForScope(prior, 'shop:3')).toEqual({kind: 'loading'});
    expect(resourceForScope(prior, null)).toEqual({kind: 'idle'});
  });

  it.each([401, 403, 404])('reports HTTP %s without substituting fixture data', async status => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => new Response(null, {status})));
    await expect(listSchemas(serviceId)).rejects.toMatchObject({kind: 'http', status});
    await expect(getSchemaGraph(schemaId)).rejects.toMatchObject({kind: 'http', status});
  });

  it('rejects mismatched responses and reads original SDL for the selected snapshot', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(Response.json([{...snapshot, serviceId: 'other'}]))
      .mockResolvedValueOnce(Response.json({...graph, schemaId: 'other'}))
      .mockResolvedValueOnce(Response.json({schemaId, schemaHash: snapshot.schemaHash, sdl: 'type Query { orders: [ID!]! }'}));
    vi.stubGlobal('fetch', fetch);
    await expect(listSchemas(serviceId)).rejects.toMatchObject({kind: 'invalid-response'});
    await expect(getSchemaGraph(schemaId)).rejects.toMatchObject({kind: 'invalid-response'});
    await expect(getSchemaSdl(schemaId)).resolves.toBe('type Query { orders: [ID!]! }');
  });
});
