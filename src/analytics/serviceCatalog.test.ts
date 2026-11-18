import {describe, expect, it} from 'vitest';
import {combineServices} from './serviceCatalog';

const service = {
  id: '00000000-0000-0000-0000-000000000001',
  name: 'Customer API',
  key: 'customer',
  isPublic: true,
  createdAt: '2026-11-15T12:00:00Z',
  updatedAt: '2026-11-15T12:00:00Z',
  endpointUrl: null,
};

describe('API service catalog', () => {
  it('shows no fabricated services if backend has none', () => {
    expect(combineServices([])).toEqual([]);
  });

  it('lists only backend services and preserves their identifiers', () => {
    const result = combineServices([service, {...service, id: '00000000-0000-0000-0000-000000000002', endpointUrl: 'https://example.com/graphql'}]);
    expect(result).toEqual([
      {id: service.id, name: service.name, endpointUrl: null},
      {id: '00000000-0000-0000-0000-000000000002', name: service.name, endpointUrl: 'https://example.com/graphql'},
    ]);
  });
});
