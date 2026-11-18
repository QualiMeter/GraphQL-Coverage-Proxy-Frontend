import {requestJson} from './client';
import {matchesSchema,getTestDetail} from './runComparison';
import {comparisonSchemas} from './comparisonSchemas';
import type {ExecutionOut,ExecutionFieldOut} from './comparisonDtos';
import {validateGroupFilters,type TestGroupFilters} from './testGroups';
export type {ExecutionOut,ExecutionFieldOut} from './comparisonDtos';
export type ExecutionStatus=ExecutionOut['status'];
export type TestCoverageSummary={runId:string;collectionStatus:'running'|'completed'|'failed';totalTests:number;totalExecutions:number;statusCounts:Record<string,number>;missingResults:number;inFlightRequests:number;totalRequests:number;attributedRequests:number;unattributedRequests:number};
export type ExecutionQuery=TestGroupFilters&{status?:ExecutionStatus;framework?:'pytest'|'playwright';testId?:string;typeName?:string;fieldName?:string;fieldMode?:'covered'|'selected'|'observed'};
export type TestPage<T>={rows:T[];total:number|null;more:boolean};
const path=(runId:string)=>`/api/runs/${encodeURIComponent(runId)}` as const;
const object=(v:unknown):v is Record<string,unknown>=>Boolean(v&&typeof v==='object'&&!Array.isArray(v));
const count=(v:unknown)=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0;
export const getExecution=getTestDetail;
export function getTestCoverage(runId:string,signal?:AbortSignal){
 return requestJson(`${path(runId)}/test-coverage`,data=>{
  if(!object(data)||data.runId!==runId||!['running','completed','failed'].includes(String(data.collectionStatus))||!['totalTests','totalExecutions','missingResults','inFlightRequests','totalRequests','attributedRequests','unattributedRequests'].every(k=>count(data[k]))||!object(data.statusCounts)||!Object.values(data.statusCounts).every(count))throw new Error('Expected TestCoverageSummary for the selected run');
  return data as TestCoverageSummary;
 },{signal});
}
function decodePage<T>(data:unknown,response:Response,offset:number,limit:number,check:(row:unknown)=>boolean):TestPage<T>{
 if(!Array.isArray(data)||data.length>limit||!data.every(check))throw new Error('Expected a Test Coverage page for the selected context');
 const header=response.headers.get('X-Total-Count'),total=header!==null&&/^\d+$/.test(header)&&Number.isSafeInteger(Number(header))?Number(header):null;
 return {rows:data as T[],total,more:total===null?data.length===limit:offset+data.length<total};
}
export function listExecutions(runId:string,query:ExecutionQuery,offset:number,signal?:AbortSignal){
 validateGroupFilters(query);
 if(!Number.isSafeInteger(offset)||offset<0||query.fieldName&&!query.typeName)throw new Error('Некорректная область списка выполнений.');
 const params=new URLSearchParams({limit:'50',offset:String(offset)});
 for(const [key,value] of Object.entries(query))if(value!==undefined&&value!==''&&value!==false)params.set(key,String(value));
 return requestJson(`${path(runId)}/tests?${params}`,(data,response)=>decodePage<ExecutionOut>(data,response,offset,50,row=>matchesSchema(row,comparisonSchemas.ExecutionOut)&&object(row)&&row.runId===runId),{signal});
}
export function getExecutionFields(runId:string,id:string,offset:number,signal?:AbortSignal){
 if(!Number.isSafeInteger(offset)||offset<0)throw new Error('Некорректная страница полей выполнения.');
 const params=new URLSearchParams({limit:'100',offset:String(offset)});
 return requestJson(`${path(runId)}/tests/${encodeURIComponent(id)}/fields?${params}`,(data,response)=>decodePage<ExecutionFieldOut>(data,response,offset,100,row=>matchesSchema(row,comparisonSchemas.ExecutionFieldOut)),{signal});
}
