import {useEffect, useMemo, useState} from 'react';
import {listServices, type ServiceOut} from '../api/services';
import {ApiError} from '../api/client';
import type {Service} from './model';
import {isMockService} from './mockService';

export type CatalogService = {
  id: string;
  name: string;
  endpointUrl: string | null;
  source: 'mock' | 'backend';
};

export function combineServices(localServices: readonly Service[], remoteServices: readonly ServiceOut[]): CatalogService[] {
  const mock = localServices.find(service => isMockService(service.id));
  return [
    ...(mock ? [{id: mock.id, name: mock.name, endpointUrl: mock.endpointUrl, source: 'mock' as const}] : []),
    ...remoteServices.map(({id, name, endpointUrl}) => ({id, name, endpointUrl: endpointUrl ?? null, source: 'backend' as const})),
  ];
}

type CatalogState =
  | {kind: 'loading'}
  | {kind: 'ready'; services: ServiceOut[]}
  | {kind: 'error'; error: ApiError};

const loading: CatalogState = {kind: 'loading'};

export function useServiceCatalog(localServices: Service[], sessionRevision: number | null) {
  const [result, setResult] = useState<{sessionRevision: number; attempt: number; state: CatalogState}>();
  const [created, setCreated] = useState<{revision: number; attempt: number; service: ServiceOut}>();
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const revision = sessionRevision;
    if (revision === null) return;
    const controller = new AbortController();
    const finish = (state: CatalogState) => {
      if (controller.signal.aborted) return;
      setResult({sessionRevision: revision, attempt, state});
      if (state.kind === 'ready') {
        setCreated(current => current?.revision === revision && current.attempt <= attempt ? undefined : current);
      }
    };
    void listServices(controller.signal).then(services => finish({kind: 'ready', services}))
      .catch((error: ApiError) => finish({kind: 'error', error}));
    return () => controller.abort();
  }, [sessionRevision, attempt]);

  // A result fetched with an earlier session must never be rendered while reloading.
  const state = result?.sessionRevision === sessionRevision && result?.attempt === attempt ? result.state : loading;
  const confirmed = created?.revision === sessionRevision ? created.service : undefined;
  const services = useMemo(
    () => combineServices(localServices, state.kind === 'ready' ? state.services : confirmed ? [confirmed] : []),
    [localServices, state, confirmed],
  );
  const retry = () => setAttempt(value => value + 1);
  function refreshAfterCreate(service: ServiceOut) {
    if (sessionRevision === null) return;
    setCreated({revision: sessionRevision, attempt: attempt + 1, service});
    retry();
  }

  return {services, state, retry, refreshAfterCreate};
}
