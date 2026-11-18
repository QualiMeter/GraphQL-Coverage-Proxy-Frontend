import {describe,it,expect} from 'vitest';
import {initialStore} from '../testSupport/fixtures';
import {coverageFor,metricsFor,operationsFor,requestsFor} from '../testSupport/model';
import {snapshotFromSDL} from '../testSupport/sdl';
describe('coherent analytics',()=>{const run=initialStore.runs[0],snapshot=initialStore.snapshots.find(s=>s.id===run.snapshotId)!;const rows=requestsFor(initialStore,run.id);
 it('derives summary from requests and separates errors',()=>{const m=metricsFor(rows);expect(m.total).toBe(rows.length);expect(m.httpErrors).toBe(rows.filter(x=>x.httpStatus>=400).length);expect(m.graphqlErrors).toBe(rows.filter(x=>x.graphqlErrors.length>0).length);expect(rows.some(x=>x.httpStatus===200&&x.graphqlErrors.length>0)).toBe(true)});
 it('excludes analyzer failures from coverage',()=>{const failed=rows.find(x=>x.analyzerError)!;const op=initialStore.operations.find(x=>x.id===failed.operationId)!;const single={...initialStore,observations:[failed]};expect(coverageFor(snapshot,run,single).summary.coveredFields).toBe(0);expect(op.fields.length).toBeGreaterThan(0)});
 it('binds history to its own snapshot',()=>{const old=initialStore.runs.find(x=>x.id==='reg12')!;const oldSnapshot=initialStore.snapshots.find(x=>x.id===old.snapshotId)!;expect(coverageFor(oldSnapshot,old,initialStore).summary.totalFields).toBeLessThan(coverageFor(snapshot,run,initialStore).summary.totalFields)});
 it('groups by structure id, not operation name',()=>{const ops=operationsFor(initialStore,snapshot,rows).filter(x=>x.name==='GetOrders');expect(ops.length).toBe(2);expect(ops[0].id).not.toBe(ops[1].id)});
 it('filters requests by a field reference',()=>{const field='Query.orders';const matching=rows.filter(r=>initialStore.operations.find(o=>o.id===r.operationId)?.fields.some(f=>`${f.type}.${f.field}`===field));expect(matching.length).toBeGreaterThan(0);expect(matching.length).toBeLessThan(rows.length)})
});
describe('SDL import',()=>{it('extracts object relations',()=>{const s=snapshotFromSDL('type Query { users: [User!]! } type User { id: ID! }','x','test','id');expect(s.types[0].fields[0].targetType).toBe('User')});it('rejects invalid SDL',()=>{expect(()=>snapshotFromSDL('type Query {','x','test','id')).toThrow()})});
