import {ApiError} from '../api/client';
import {findRun,listRuns,runPageSize,type RunOut} from '../api/runs';
import type {RunPreference} from './workspaceSelection';
export async function resolveServiceRun(serviceId:string,snapshots:readonly {id:string}[],saved:RunPreference|null,signal:AbortSignal):Promise<RunOut|null>{
 const accessible=new Set(snapshots.map(snapshot=>snapshot.id));
 function check(){if(signal.aborted)throw new DOMException('Выбор прогона отменён','AbortError')}
 check();
 if(saved&&accessible.has(saved.snapshotId)){
  try{const run=await findRun(saved.snapshotId,saved.runId,signal);check();if(run&&accessible.has(run.snapshotId))return run}
  catch(error){check();if(!(error instanceof ApiError)||![403,404].includes(error.status??0))throw error}
 }
 // The server orders each candidate page. Read further only if every row on a
 // page points to an inaccessible snapshot, never to collect history eagerly.
 for(const status of ['running',undefined] as const){
  for(let offset=0;;offset+=runPageSize){
   check();
   const page=await listRuns({serviceId},offset,signal,{status,sortBy:'startedAt',sortOrder:'desc'});check();
   const run=page.runs.find(run=>accessible.has(run.snapshotId)&&(status===undefined||run.status===status));
   if(run)return run;
   if(!page.hasMore||!page.runs.length)break;
  }
 }
 return null;
}
