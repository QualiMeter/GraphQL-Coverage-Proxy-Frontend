import {describe,it,expect,vi} from 'vitest';
import {initialStore} from './fixtures';
import {coverageFor,metricsFor,requestsFor} from './model';
describe('local mock source',()=>{it('does not make HTTP requests',()=>{const spy=vi.spyOn(globalThis,'fetch');const run=initialStore.runs[0];const snapshot=initialStore.snapshots.find(x=>x.id===run.snapshotId)!;coverageFor(snapshot,run,initialStore);metricsFor(requestsFor(initialStore,run.id));expect(spy).not.toHaveBeenCalled();spy.mockRestore()});it('keeps a new run empty',()=>{const snapshot=initialStore.snapshots[0];const run={...initialStore.runs[0],id:'new'};expect(coverageFor(snapshot,run,initialStore).summary.coveredFields).toBe(0);expect(requestsFor(initialStore,run.id)).toHaveLength(0)})});
