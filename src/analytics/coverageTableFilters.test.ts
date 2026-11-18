import {describe, expect, it} from 'vitest';
import {snapshotFromSDL} from '../testSupport/sdl';
import {coverageRows, defaultAdvancedFilters, filterCoverageRows} from './coverageTableFilters';

const sdl = `
  scalar DateTime
  enum Status { OPEN CLOSED }
  type Query { customers: [Customer!]! }
  type Customer {
    active: Boolean!
    address: Address!
    history: [[Address!]!]!
    createdAt: DateTime!
    legacy: String @deprecated(reason: "Use active")
    status: Status
    unknown: Unknown
  }
  type Address { city: String }
`;
const types = snapshotFromSDL(sdl, 'service', 'schema', 'snapshot').types;
const hits: Record<string, number> = {active: 1, address: 5, history: 6, createdAt: 20, status: 21};
for (const field of types.flatMap(type => type.fields)) {
  field.hits = hits[field.name] ?? 0;
  field.covered = field.hits > 0;
}
const rows = coverageRows(types, sdl);
const allFilters = {...defaultAdvancedFilters, search: '', type: '', coverage: 'all'} as const;

describe('coverage table filters', () => {
  it('combines search, parent type, coverage, hits and deprecation', () => {
    const filters = {...allFilters, type: 'Customer', coverage: 'uncovered', hits: 'zero', deprecated: 'yes'} as const;
    expect(filterCoverageRows(rows, {...filters, search: 'customer.legacy'}, 'date').map(row => row.id))
      .toEqual(['Customer.legacy']);
    expect(filterCoverageRows(rows, {...filters, search: 'history'}, 'date')).toEqual([]);
  });

  it('classifies outer lists and known scalar and object types separately', () => {
    const fields = (returns: 'list' | 'scalar' | 'object') =>
      filterCoverageRows(rows, {...allFilters, returns}, 'type-field').map(row => row.id);
    expect(fields('list')).toEqual(['Customer.history', 'Query.customers']);
    expect(fields('object')).toEqual(['Customer.address']);
    expect(fields('scalar')).toEqual(['Address.city', 'Customer.active', 'Customer.createdAt', 'Customer.legacy']);
  });

  it('applies inclusive hit buckets and sorts by type before field', () => {
    const bucket = (hits: 'low' | 'medium' | 'high') =>
      filterCoverageRows(rows, {...allFilters, hits}, 'hits-asc').map(row => row.field.hits);
    expect(bucket('low')).toEqual([1, 5]);
    expect(bucket('medium')).toEqual([6, 20]);
    expect(bucket('high')).toEqual([21]);
    expect(filterCoverageRows(rows, allFilters, 'type-field').slice(0, 3).map(row => row.id))
      .toEqual(['Address.city', 'Customer.active', 'Customer.address']);
  });
});
