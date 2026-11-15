import {requestJson} from './client';

export type SchemaOut = {
  id: string;
  serviceId: string;
  schemaHash: string;
  source: string;
  createdAt: string;
  displayName?: string | null;
};

export type RootOperation = 'query' | 'mutation' | 'subscription';
type GraphArgument = {name: string; type: string};
type GraphField = {
  name: string;
  returnType: string;
  targetType: string | null;
  deprecated: boolean;
  covered: boolean;
  hits: number;
  description?: string | null;
  deprecationReason?: string | null;
  args?: GraphArgument[];
};
type GraphType = {
  name: string;
  kind: string;
  totalFields: number;
  coveredFields: number;
  coveragePercent: number | null;
  fields: GraphField[];
  rootOperations?: RootOperation[];
  description?: string | null;
};
type GraphRelation = {id: string; fromType: string; field: string; toType: string; covered: boolean};
type CoverageSummary = {totalFields: number; coveredFields: number; coveragePercent: number | null};
export type CoverageGraph = {
  schemaId: string;
  runId: string | null;
  summary: CoverageSummary;
  rootTypes?: Partial<Record<RootOperation, string | null>>;
  types: GraphType[];
  relations: GraphRelation[];
};

const object = (data: unknown): data is Record<string, unknown> =>
  typeof data === 'object' && data !== null && !Array.isArray(data);
const strings = (data: Record<string, unknown>, ...keys: string[]) => keys.every(key => typeof data[key] === 'string');
const optionalString = (value: unknown) => value == null || typeof value === 'string';
const count = (value: unknown) => typeof value === 'number' && Number.isInteger(value) && value >= 0;
const percentage = (value: unknown) => value === null || typeof value === 'number' && Number.isFinite(value);
const rootOperations: readonly RootOperation[] = ['query', 'mutation', 'subscription'];

function field(data: unknown): boolean {
  return object(data) && strings(data, 'name', 'returnType') &&
    (data.targetType === null || typeof data.targetType === 'string') &&
    typeof data.deprecated === 'boolean' && typeof data.covered === 'boolean' && count(data.hits) &&
    optionalString(data.description) && optionalString(data.deprecationReason) &&
    (data.args === undefined || Array.isArray(data.args) && data.args.every(arg => object(arg) && strings(arg, 'name', 'type')));
}

function graphType(data: unknown): boolean {
  return object(data) && strings(data, 'name', 'kind') && count(data.totalFields) &&
    count(data.coveredFields) && percentage(data.coveragePercent) && optionalString(data.description) &&
    Array.isArray(data.fields) && data.fields.every(field) &&
    (data.rootOperations === undefined || Array.isArray(data.rootOperations) && data.rootOperations.every(role => rootOperations.includes(role)));
}

export function listSchemas(serviceId: string, signal?: AbortSignal) {
  return requestJson(`/api/schemas?${new URLSearchParams({serviceId})}`, data => {
    if (!Array.isArray(data) || !data.every(item => object(item) && item.serviceId === serviceId &&
      strings(item, 'id', 'schemaHash', 'source', 'createdAt') && optionalString(item.displayName))) {
      throw new Error('Expected SchemaOut[] for the selected service');
    }
    return data as SchemaOut[];
  }, {signal});
}

export function getSchemaGraph(schemaId: string, signal?: AbortSignal) {
  return requestJson(`/api/schemas/${encodeURIComponent(schemaId)}/graph`, data => {
    if (!object(data) || data.schemaId !== schemaId || data.runId !== null ||
      !object(data.summary) || !count(data.summary.totalFields) || !count(data.summary.coveredFields) ||
      !percentage(data.summary.coveragePercent) ||
      (data.rootTypes !== undefined && (!object(data.rootTypes) ||
        !Object.values(data.rootTypes).every(optionalString))) ||
      !Array.isArray(data.types) || !data.types.every(graphType) ||
      !Array.isArray(data.relations) || !data.relations.every(relation => object(relation) &&
        strings(relation, 'id', 'fromType', 'field', 'toType') && typeof relation.covered === 'boolean')) {
      throw new Error('Expected CoverageGraph for the selected snapshot');
    }
    return data as CoverageGraph;
  }, {signal});
}

export function getSchemaSdl(schemaId: string, signal?: AbortSignal) {
  return requestJson(`/api/schemas/${encodeURIComponent(schemaId)}/sdl`, data => {
    if (!object(data) || data.schemaId !== schemaId || !strings(data, 'schemaHash', 'sdl')) {
      throw new Error('Expected SchemaSdlOut for the selected snapshot');
    }
    return data.sdl as string;
  }, {signal});
}
