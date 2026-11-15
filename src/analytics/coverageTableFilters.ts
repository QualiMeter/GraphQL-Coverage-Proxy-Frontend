import {Kind, parse, parseType, specifiedScalarTypes} from 'graphql';
import {fieldId, type SchemaType} from '../model';

export type CoverageFilter = 'all' | 'covered' | 'uncovered';
export type CoverageSort = 'date' | 'type-field' | 'hits-asc' | 'hits';

const hitRanges = {zero: [0, 0], low: [1, 5], medium: [6, 20], high: [21, Infinity]} as const;

export type AdvancedFilters = {
  hits: 'all' | keyof typeof hitRanges;
  returns: 'all' | 'scalar' | 'object' | 'list';
  deprecated: 'all' | 'yes' | 'no';
};

export const defaultAdvancedFilters: AdvancedFilters = {hits: 'all', returns: 'all', deprecated: 'all'};

function returnKind(signature: string, kinds: ReadonlyMap<string, string>) {
  try {
    const parsed = parseType(signature, {noLocation: true});
    const outer = parsed.kind === Kind.NON_NULL_TYPE ? parsed.type : parsed;
    if (outer.kind === Kind.LIST_TYPE) return 'list';
    const kind = kinds.get(outer.name.value);
    if (kind === 'OBJECT') return 'object';
    if (kind === 'SCALAR') return 'scalar';
  } catch {
    // An unrecognized signature has no return category.
  }
}

export function coverageRows(types: readonly SchemaType[], sdl?: string) {
  const kinds = new Map<string, string>(specifiedScalarTypes.map(type => [type.name, 'SCALAR']));
  for (const type of types) kinds.set(type.name, type.kind);
  if (sdl) {
    try {
      for (const definition of parse(sdl, {noLocation: true}).definitions) {
        if (definition.kind === Kind.SCALAR_TYPE_DEFINITION) kinds.set(definition.name.value, 'SCALAR');
      }
    } catch {
      // Keep the type metadata available in the snapshot.
    }
  }
  return types.flatMap(type => type.fields.map(field => ({
    type: type.name,
    field,
    id: fieldId(type.name, field.name),
    returns: returnKind(field.returnType, kinds),
  })));
}

type Filters = AdvancedFilters & {
  search: string;
  coverage: CoverageFilter;
  type: string;
};

export function filterCoverageRows(rows: ReturnType<typeof coverageRows>, filters: Filters, order: CoverageSort) {
  const [minHits, maxHits] = filters.hits === 'all' ? [0, Infinity] : hitRanges[filters.hits];
  return rows.filter(({type, field, id, returns}) => (
    (!filters.type || type === filters.type) &&
    (filters.coverage === 'all' || field.covered === (filters.coverage === 'covered')) &&
    (!filters.search || `${type} ${field.name} ${id} ${field.returnType}`.toLowerCase().includes(filters.search)) &&
    (filters.hits === 'all' || field.hits >= minHits && field.hits <= maxHits) &&
    (filters.returns === 'all' || returns === filters.returns) &&
    (filters.deprecated === 'all' || field.deprecated === (filters.deprecated === 'yes'))
  )).sort((a, b) => {
    const byType = a.type.localeCompare(b.type);
    const byField = a.field.name.localeCompare(b.field.name);
    if (order === 'type-field') return byType || byField;
    const byName = byField || byType;
    if (order === 'date') return byName;
    const byHits = a.field.hits - b.field.hits;
    return (order === 'hits-asc' ? byHits : -byHits) || byName;
  });
}
