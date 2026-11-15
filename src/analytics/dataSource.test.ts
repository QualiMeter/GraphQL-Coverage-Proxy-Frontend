import {describe,expect,it,vi} from 'vitest';
import {addLocalService,schemaByIntrospection,validateEndpoint} from './dataSource';
import {initialStore} from './fixtures';
import {coverageDistribution,coverageFor,metricsFor,requestsFor} from './model';
import {loadStore,saveStore} from './storage';
import {snapshotFromSDL} from './sdl';

describe('local service data source',()=>{
 it('accepts HTTPS and local HTTP endpoints',()=>{expect(validateEndpoint('https://api.example.com/graphql')).toBe('https://api.example.com/graphql');expect(validateEndpoint('http://localhost:4000/graphql')).toBe('http://localhost:4000/graphql')});
 it('rejects invalid, remote HTTP and secret-bearing URLs',()=>{for(const url of ['example','http://api.example.com/graphql','https://user:pass@example.com/graphql','https://api.example.com/graphql?token=secret','https://api.example.com/graphql#key','https://api.example.com/token/abc'])expect(()=>validateEndpoint(url)).toThrow()});
 it('adds a service without inventing a snapshot or run',()=>{const next=addLocalService(initialStore,{name:'Catalog',endpointUrl:'https://catalog.example.com/graphql',description:'Catalog schema'},'catalog','2026-11-15T00:00:00Z');expect(next.services.at(-1)).toMatchObject({id:'catalog',name:'Catalog',endpointUrl:'https://catalog.example.com/graphql',description:'Catalog schema'});expect(next.snapshots).toHaveLength(initialStore.snapshots.length);expect(next.runs).toHaveLength(initialStore.runs.length)});
 it('persists locally created services and snapshots',()=>{const data=new Map<string,string>();vi.stubGlobal('localStorage',{getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>{data.set(key,value)}});try{const withService=addLocalService(initialStore,{name:'Catalog',endpointUrl:'https://catalog.example.com/graphql',description:''},'catalog','2026-11-15T00:00:00Z');const newSnapshot=snapshotFromSDL('type Query { product: Product } type Product { id: ID! }','catalog','Catalog v1','catalog-v1');saveStore({...withService,snapshots:[...withService.snapshots,newSnapshot]});const loaded=loadStore();expect(loaded.services.find(service=>service.id==='catalog')?.endpointUrl).toBe('https://catalog.example.com/graphql');expect(loaded.snapshots.find(snapshot=>snapshot.id==='catalog-v1')).toMatchObject({serviceId:'catalog',source:'sdl'});expect(loaded.runs.filter(run=>run.serviceId==='catalog')).toHaveLength(0)}finally{vi.unstubAllGlobals()}});
 it('keeps introspection unavailable without a backend',async()=>{const result=await schemaByIntrospection(initialStore.services[0]);expect(result.status).toBe('unavailable')});
});

describe('current run summary',()=>{
 it('counts unique observed operations and nearest-rank P95',()=>{const rows=requestsFor(initialStore,'reg13');const metrics=metricsFor(rows);expect(metrics.uniqueOperations).toBe(new Set(rows.map(row=>row.operationId)).size);const durations=rows.map(row=>row.durationMs).sort((a,b)=>a-b);expect(metrics.p95Ms).toBe(durations[Math.ceil(.95*durations.length)-1]);expect(metrics.httpErrors).toBe(rows.filter(row=>row.httpStatus>=400&&row.httpStatus<=599).length)});
 it('counts object type coverage without root operation types',()=>{const snapshot=initialStore.snapshots.find(item=>item.id==='customer-v2')!;const run=initialStore.runs.find(item=>item.id==='reg13')!;const types=coverageFor(snapshot,run,initialStore).types;const distribution=coverageDistribution(types);expect(distribution.total).toBe(types.filter(type=>!type.role).length);expect(distribution.zero+distribution.partial+distribution.complete).toBe(distribution.total)});
 it('does not mix Billing and Customer metrics',()=>{const billing=initialStore.snapshots.find(item=>item.id==='billing-v1')!;const run=initialStore.runs.find(item=>item.id==='billing-run')!;const coverage=coverageFor(billing,run,initialStore);expect(coverage.types.map(type=>type.name)).toEqual(['Query','Invoice']);expect(metricsFor(requestsFor(initialStore,run.id)).total).toBe(12)});
});
