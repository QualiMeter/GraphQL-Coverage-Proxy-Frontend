import {ApiError,requestJson} from './client';
import {listRuns,type RunQuery,type RunScope} from './runs';
export type {RunCi} from './runCi';
export type GitlabJob={jobId:number;name:string;stage:string;status:string;url:string;createdAt:string;startedAt:string|null;finishedAt:string|null};
export type GitlabJobPage={runId:string;pipelineId:number|null;jobsSyncedAt:string|null;jobsFinalized:boolean;total:number;jobs:GitlabJob[]};
const object=(value:unknown):value is Record<string,unknown>=>Boolean(value)&&typeof value==='object'&&!Array.isArray(value);
const id=(value:unknown):value is number=>typeof value==='number'&&Number.isSafeInteger(value)&&value>0;
const date=(value:unknown)=>typeof value==='string'&&Number.isFinite(Date.parse(value));
const nullableDate=(value:unknown)=>value===null||date(value);

export function getGitlabJobs(runId:string,pipelineId:number,offset:number,signal?:AbortSignal){
 if(!Number.isSafeInteger(offset)||offset<0)throw new Error('Некорректная страница CI jobs.');
 return requestJson(`/api/runs/${encodeURIComponent(runId)}/gitlab/jobs?${new URLSearchParams({limit:'100',offset:String(offset)})}`,data=>{
  if(!object(data)||data.runId!==runId||data.pipelineId!==pipelineId||!nullableDate(data.jobsSyncedAt)||typeof data.jobsFinalized!=='boolean'||typeof data.total!=='number'||!Number.isSafeInteger(data.total)||data.total<0||!Array.isArray(data.jobs)||data.jobs.length>100||!data.jobs.every(job=>object(job)&&id(job.jobId)&&['name','stage','status','url'].every(key=>typeof job[key]==='string')&&date(job.createdAt)&&nullableDate(job.startedAt)&&nullableDate(job.finishedAt)))throw new Error('Некорректный ответ CI jobs или другой pipeline.');
  if(new Set(data.jobs.map(job=>(job as GitlabJob).jobId)).size!==data.jobs.length)throw new Error('Повторяющиеся ID CI jobs.');
  return data as GitlabJobPage;
 },{signal});
}
export function usesCi(query:RunQuery){return Boolean(query.sortBy&&query.sortBy!=='startedAt'||['branch','commitSha','environment','pipelineId','pipelineStatus','jobId','jobName','jobStatus'].some(key=>query[key as keyof RunQuery]!==undefined))}
export async function readHistoryPage(scope:RunScope,offset:number,signal:AbortSignal,query:RunQuery){
 try{return {page:await listRuns(scope,offset,signal,query),offset,ciError:undefined as Error|undefined}}catch(error){
  if(!signal.aborted&&usesCi(query)&&error instanceof ApiError&&[401,403,404].includes(error.status??0)){
   const ordinary={status:query.status,from:query.from,to:query.to,sortBy:'startedAt' as const,sortOrder:query.sortOrder};
   return {page:await listRuns(scope,offset,signal,ordinary),offset,ciError:error};
  }
  throw error;
 }
}
