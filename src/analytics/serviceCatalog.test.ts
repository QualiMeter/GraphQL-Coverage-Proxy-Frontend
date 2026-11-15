import {afterEach, describe, expect, it, vi} from 'vitest';
import {initialStore} from './fixtures';
import {isMockService, MOCK_SERVICE_ID} from './mockService';
import {combineServices} from './serviceCatalog';
import {loadStore, saveStore} from './storage';

afterEach(() => vi.unstubAllGlobals());

describe('mock and API services', () => {
  it('exposes exactly one mock alongside the API services, with independent identities', () => {
    const id = '00000000-0000-0000-0000-000000000001';
    const catalog = combineServices(initialStore.services, [{
      id, name: 'Mock Customer API', key: 'customer', isPublic: true,
      createdAt: '2026-11-15T12:00:00Z', updatedAt: '2026-11-15T12:00:00Z', endpointUrl: null,
    }]);
    expect(catalog.map(service => [service.id, service.source])).toEqual([
      [MOCK_SERVICE_ID, 'mock'], [id, 'backend'],
    ]);
    expect(catalog[1].endpointUrl).toBeNull();
    expect(isMockService(id)).toBe(false);
    expect(combineServices(initialStore.services, []).map(service => service.id)).toEqual([MOCK_SERVICE_ID]);
    expect(initialStore.runs.find(run => run.id === 'reg13')?.serviceId).toBe(MOCK_SERVICE_ID);
  });

  it('retains saved Customer snapshots and runs under the namespaced mock ID', () => {
    const snapshot = {...initialStore.snapshots[0], id: 'imported', serviceId: 'customer'};
    const run = {...initialStore.runs[0], id: 'local-run', snapshotId: snapshot.id, serviceId: 'customer'};
    const storage = {
      getItem: vi.fn().mockReturnValue(JSON.stringify({snapshots: [snapshot], runs: [run]})),
      setItem: vi.fn(),
    };
    vi.stubGlobal('localStorage', storage);

    const restored = loadStore();
    expect(restored.snapshots.at(-1)).toMatchObject({id: snapshot.id, serviceId: MOCK_SERVICE_ID});
    expect(restored.runs.at(-1)).toMatchObject({id: run.id, snapshotId: snapshot.id, serviceId: MOCK_SERVICE_ID});
    saveStore(restored);
    expect(JSON.parse(storage.setItem.mock.calls[0][1])).toMatchObject({
      services: [],
      snapshots: [{id: snapshot.id, serviceId: MOCK_SERVICE_ID}],
      runs: [{id: run.id, serviceId: MOCK_SERVICE_ID}],
    });
  });
});
