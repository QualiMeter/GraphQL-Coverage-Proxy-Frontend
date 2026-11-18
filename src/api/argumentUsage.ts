import {requestJson} from './client';
export type ArgumentUsage={typeName:string;fieldName:string;argumentName:string;argumentType:string;hasSchemaDefault:boolean;providedCount:number;explicitNullCount:number;omittedCount:number;unknownCount:number;mixedCount:number;requestCount:number};
export type ArgumentUsagePage={runId:string;snapshotId:string;availability:'available'|'partial'|'unavailable';totalRequests:number;analyzedRequests:number;unavailableRequests:number;total:number;limit:number;offset:number;items:ArgumentUsage[]};
const object=(value:unknown):value is Record<string,unknown>=>Boolean(value)&&typeof value==='object'&&!Array.isArray(value);
const count=(value:unknown):value is number=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0;
const counters=['providedCount','explicitNullCount','omittedCount','unknownCount','mixedCount'] as const;
export function decodeArguments(data:unknown,runId:string,snapshotId:string,typeName:string,fieldName:string,offset:number):ArgumentUsagePage{
 if(!object(data)||data.runId!==runId||data.snapshotId!==snapshotId||data.limit!==100||data.offset!==offset||!['available','partial','unavailable'].includes(String(data.availability))||!['totalRequests','analyzedRequests','unavailableRequests','total','offset'].every(key=>count(data[key]))||!Array.isArray(data.items)||data.items.length>100)throw new Error('Invalid Argument Usage page');
 const page=data as unknown as ArgumentUsagePage;
 const expected=page.analyzedRequests===0?'unavailable':page.unavailableRequests===0?'available':'partial';
 if(page.totalRequests!==page.analyzedRequests+page.unavailableRequests||page.availability!==expected||page.items.length>page.total)throw new Error('Invalid Argument Usage availability');
 const names=new Set<string>();
 for(const row of page.items){
  if(!object(row)||row.typeName!==typeName||row.fieldName!==fieldName||typeof row.argumentName!=='string'||typeof row.argumentType!=='string'||typeof row.hasSchemaDefault!=='boolean'||!count(row.requestCount)||!counters.every(key=>count(row[key]))||row.requestCount!==counters.reduce((sum,key)=>sum+row[key],0)||row.requestCount>page.analyzedRequests||names.has(row.argumentName))throw new Error('Invalid Argument Usage row');
  names.add(row.argumentName);
 }
 return page;
}
export function getArgumentUsage(runId:string,snapshotId:string,typeName:string,fieldName:string,offset=0,signal?:AbortSignal){
 if(!count(offset))throw new Error('Некорректная страница использования аргументов.');
 const params=new URLSearchParams({typeName,fieldName,limit:'100',offset:String(offset)});
 return requestJson(`/api/runs/${encodeURIComponent(runId)}/arguments?${params}`,data=>decodeArguments(data,runId,snapshotId,typeName,fieldName,offset),{signal});
}
