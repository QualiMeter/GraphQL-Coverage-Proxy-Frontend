import {useEffect, useState} from 'react';
import {ApiError} from '../api/client';
import {getSchemaGraph, getSchemaSdl, listSchemas} from '../api/schemas';

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

  return {state: resourceForScope(result, key), retry: () => setAttempt(value => value + 1)};
}

export function useBackendSchema(serviceId: string | null, requestedId: string, serviceScope: string, snapshotScope: string) {
  const snapshots = useSchemaResource(serviceId, serviceScope, listSchemas);
  const items = snapshots.state.kind === 'ready' ? snapshots.state.data : [];
  const selected = items.find(item => item.id === requestedId) ?? items[0] ?? null;
  const graph = useSchemaResource(selected?.id ?? null, snapshotScope, getSchemaGraph);
  return {snapshots, items, selected, graph};
}

export function useBackendSdl(schemaId: string | null, scope: string) {
  return useSchemaResource(schemaId, scope, getSchemaSdl);
}
