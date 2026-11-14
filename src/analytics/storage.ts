import type {Store} from './model';
import {initialStore} from './fixtures';
const key='gcp-local-v1';
export function loadStore():Store{try{const raw=localStorage.getItem(key);if(!raw)return initialStore;const extra=JSON.parse(raw) as Pick<Store,'services'|'snapshots'|'runs'>;return {...initialStore,services:[...initialStore.services,...extra.services],snapshots:[...initialStore.snapshots,...extra.snapshots],runs:[...initialStore.runs,...extra.runs]}}catch{return initialStore}}
export function saveStore(store:Store){localStorage.setItem(key,JSON.stringify({services:store.services.filter(x=>!initialStore.services.some(y=>y.id===x.id)),snapshots:store.snapshots.filter(x=>!initialStore.snapshots.some(y=>y.id===x.id)),runs:store.runs.filter(x=>!initialStore.runs.some(y=>y.id===x.id))}))}
