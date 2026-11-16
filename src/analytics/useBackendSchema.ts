import {useEffect, useMemo, useState} from 'react';
import {ApiError} from '../api/client';
import {type SchemaOut, getSchemaGraph, getSchemaSdl, listSchemas} from '../api/schemas';

export type SchemaResource<T> =
  | {kind: 'idle' | 'loading'}
  | {kind: 'ready'; data: T}
  | {kind: 'error'; error: ApiError};

export function resourceForScope<T>(
  result: {key: string; state: SchemaResource<T>} | undefined, key: string | null,
): SchemaResource<T> {
  if (key === null) return {kind: 'idle'};
  return result?.key === key ? result.state : {kind: 'loading'};
}

function useSchemaResource<T>(id: string | null, scope: string, load: (id: string, signal: AbortSignal) => Promise<T>, keepReady = false) {
  const [attempt, setAttempt] = useState(0);
  const identity = id === null ? null : JSON.stringify([id, scope]);
  const key = identity === null ? null : JSON.stringify([identity, attempt]);
  const [result, setResult] = useState<{key: string; identity: string | null; state: SchemaResource<T>}>();

  useEffect(() => {
    if (key === null || id === null) return;
    const controller = new AbortController();
    const finish = (state: SchemaResource<T>) => {
      if (!controller.signal.aborted) setResult({key, identity, state});
    };
    void load(id, controller.signal)
      .then(data => finish({kind: 'ready', data}))
      .catch((error: ApiError) => finish({kind: 'error', error}));
    return () => controller.abort();
  }, [id, identity, key, load]);

  function replace(update: (data:T)=>T) {
    setResult(previous => previous?.key === key && previous.state.kind === 'ready'
      ? {key:previous.key,identity:previous.identity,state:{kind:'ready',data:update(previous.state.data)}} : previous);
  }
  const next=resourceForScope(result,key);
  const state=keepReady&&next.kind==='loading'&&result?.identity===identity&&result.state.kind==='ready'
    ?result.state:next;
  return {state, refreshing:next.kind==='loading', replace, retry: () => setAttempt(value => value + 1)};
}

export function useBackendSchema(serviceId: string | null, requestedId: string, serviceScope: string, snapshotScope: string) {
  const snapshots = useSchemaResource(serviceId, serviceScope, listSchemas);
  const items = useMemo(() => snapshots.state.kind === 'ready'
    ? [...snapshots.state.data].sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt)) : [], [snapshots.state]);
  function replaceSnapshot(snapshot: SchemaOut) {
    snapshots.replace(data=>data.map(item=>item.id===snapshot.id?snapshot:item));
  }
  const selected = items.find(item => item.id === requestedId) ?? items[0] ?? null;
  const graph = useSchemaResource(selected?.id ?? null, snapshotScope, getSchemaGraph, true);
  return {snapshots, items, selected, graph, replaceSnapshot};
}

export function useBackendSdl(schemaId: string | null, scope: string) {
  return useSchemaResource(schemaId, scope, getSchemaSdl);
}
