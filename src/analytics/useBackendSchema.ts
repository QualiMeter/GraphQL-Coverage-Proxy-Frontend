import {useEffect, useState} from 'react';
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

function useSchemaResource<T>(id: string | null, scope: string, load: (id: string, signal: AbortSignal) => Promise<T>) {
  const [attempt, setAttempt] = useState(0);
  const key = id === null ? null : JSON.stringify([id, scope, attempt]);
  const [result, setResult] = useState<{key: string; state: SchemaResource<T>}>();

  useEffect(() => {
    if (key === null || id === null) return;
    const controller = new AbortController();
    const finish = (state: SchemaResource<T>) => {
      if (!controller.signal.aborted) setResult({key, state});
    };
    void load(id, controller.signal)
      .then(data => finish({kind: 'ready', data}))
      .catch((error: ApiError) => finish({kind: 'error', error}));
    return () => controller.abort();
  }, [id, key, load]);

  function replace(update: (data:T)=>T) {
    setResult(previous => previous?.key === key && previous.state.kind === 'ready'
      ? {key:previous.key,state:{kind:'ready',data:update(previous.state.data)}} : previous);
  }
  return {state: resourceForScope(result, key), replace, retry: () => setAttempt(value => value + 1)};
}

export function useBackendSchema(serviceId: string | null, requestedId: string, serviceScope: string, snapshotScope: string) {
  const snapshots = useSchemaResource(serviceId, serviceScope, listSchemas);
  const items = snapshots.state.kind === 'ready' ? snapshots.state.data : [];
  function replaceSnapshot(snapshot: SchemaOut) {
    snapshots.replace(data=>data.map(item=>item.id===snapshot.id?snapshot:item));
  }
  const selected = items.find(item => item.id === requestedId) ?? items[0] ?? null;
  const graph = useSchemaResource(selected?.id ?? null, snapshotScope, getSchemaGraph);
  return {snapshots, items, selected, graph, replaceSnapshot};
}

export function useBackendSdl(schemaId: string | null, scope: string) {
  return useSchemaResource(schemaId, scope, getSchemaSdl);
}
