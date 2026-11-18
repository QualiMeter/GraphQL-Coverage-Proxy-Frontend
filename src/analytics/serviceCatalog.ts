import {useEffect, useMemo, useState} from 'react';
import {listServices, type ServiceOut} from '../api/services';
import {ApiError} from '../api/client';

export type CatalogService = {
  id: string;
  name: string;
  endpointUrl: string | null;
  source: 'backend';
};

export function combineServices(remoteServices: readonly ServiceOut[]): CatalogService[] {
 return remoteServices.map(({id,name,endpointUrl})=>({id,name,endpointUrl:endpointUrl??null,source:'backend'}));
}

export function availableServiceId(id:string,services:readonly CatalogService[]):string {
 return services.some(service=>service.id===id)?id:services[0]?.id??'';
}

type CatalogState =
  | {kind: 'loading'}
  | {kind: 'ready'; services: ServiceOut[]}
  | {kind: 'error'; error: ApiError};

const loading: CatalogState = {kind: 'loading'};

export function useServiceCatalog(sessionRevision: number | null) {
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
    () => combineServices(state.kind === 'ready' ? state.services : confirmed ? [confirmed] : []),
    [state, confirmed],
  );
  const retry = () => setAttempt(value => value + 1);
  function refreshAfterCreate(service: ServiceOut) {
    if (sessionRevision === null) return;
    setCreated({revision: sessionRevision, attempt: attempt + 1, service});
    retry();
  }

  function replaceService(service: ServiceOut) {
    setResult(current => current?.sessionRevision === sessionRevision && current.state.kind === 'ready'
      ? {...current,state:{kind:'ready',services:current.state.services.map(item=>item.id===service.id?service:item)}}
      : current);
  }

  return {services, state, retry, refreshAfterCreate, replaceService};
}
