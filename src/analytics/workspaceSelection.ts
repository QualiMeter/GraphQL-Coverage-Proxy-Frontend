export type WorkspaceSelection={serviceId:string;snapshotId:string|null;runId:string|null};
export type RunPreference={runId:string;snapshotId:string};
type RecordV2={version:2;context:WorkspaceSelection|null;runsByService:Record<string,RunPreference>};
const storageKey=(owner:string)=>`graphql-coverage.workspace.v2.${encodeURIComponent(owner)}`;
const object=(value:unknown):value is Record<string,unknown>=>Boolean(value)&&typeof value==='object'&&!Array.isArray(value);
const id=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(value);
const preference=(value:unknown):value is RunPreference=>object(value)&&id(value.runId)&&id(value.snapshotId);
function readRecord(owner:string):RecordV2{
 const empty:RecordV2={version:2,context:null,runsByService:{}};
 try{
  const raw:unknown=JSON.parse(localStorage.getItem(storageKey(owner))??'null');
  if(!object(raw)||raw.version!==2)return empty;
  const context=object(raw.context)&&id(raw.context.serviceId)&&(raw.context.snapshotId===null||id(raw.context.snapshotId))&&(raw.context.runId===null||id(raw.context.runId))?{serviceId:raw.context.serviceId,snapshotId:raw.context.snapshotId,runId:raw.context.runId}:null;
  const runsByService=object(raw.runsByService)?Object.fromEntries(Object.entries(raw.runsByService).filter(([service,value])=>id(service)&&preference(value)).map(([service,value])=>[service,{runId:(value as RunPreference).runId,snapshotId:(value as RunPreference).snapshotId}])):{};
  return {version:2,context,runsByService};
 }catch{return empty}
}
function writeRecord(owner:string,value:RecordV2){try{localStorage.setItem(storageKey(owner),JSON.stringify(value))}catch{/* Keep the current dashboard usable when storage is disabled. */}}
export const workspaceOwner=(userId:string|null|undefined)=>userId?`user:${userId}`:'anonymous';
export function readWorkspace(owner:string):WorkspaceSelection|null{return readRecord(owner).context}
export function readRunPreference(owner:string,serviceId:string):RunPreference|null{return readRecord(owner).runsByService[serviceId]??null}
export function saveWorkspace(selection:WorkspaceSelection,owner:string){
 const record=readRecord(owner);writeRecord(owner,{...record,context:selection});
}
export function rememberRun(owner:string,serviceId:string,run:RunPreference){
 if(!id(serviceId)||!preference(run))return;
 const record=readRecord(owner);
 writeRecord(owner,{...record,context:{serviceId,snapshotId:run.snapshotId,runId:run.runId},runsByService:{...record.runsByService,[serviceId]:{runId:run.runId,snapshotId:run.snapshotId}}});
}
