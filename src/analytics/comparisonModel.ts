import {ApiError} from '../api/client';
import type {RunOut} from '../api/runs';
import type {OperationOut} from '../api/runAnalytics';
import type {ExecutionOut,RequestDetailOut} from '../api/runComparison';

export function selectionError(runs:readonly RunOut[],snapshotId:string,baseline:string,target:string){
 if(runs.length<2||runs.length>20)return 'Выберите от 2 до 20 прогонов.';
 if(new Set(runs.map(r=>r.id)).size!==runs.length)return 'Повторяющиеся прогоны недопустимы.';
 if(runs.some(r=>r.snapshotId!==snapshotId))return 'Все прогоны должны использовать один снимок.';
 if(runs.some(r=>r.status!=='completed'))return 'Допустимы только завершённые прогоны.';
 if(baseline===target||!runs.some(r=>r.id===baseline)||!runs.some(r=>r.id===target))return 'Выберите разные baseline и target из выбранных прогонов.';
 return null;
}
export const chronological=(runs:readonly RunOut[])=>[...runs].sort((a,b)=>Date.parse(a.startedAt)-Date.parse(b.startedAt)||a.id.localeCompare(b.id));
export function comparisonError(error:Error){
 if(error instanceof ApiError){
  if(error.code==='RUN_NOT_COMPLETED')return 'Один из прогонов не завершён либо GitLab-сбор неполон. Измените выбор.';
  if(error.code==='SNAPSHOT_MISMATCH')return 'Прогоны используют разные снимки схемы.';
  if(error.status===401)return 'Войдите в систему для доступа к этим данным.';
  if(error.status===403)return 'Недостаточно прав для доступа к этим данным.';
  if(error.status===404)return 'Маршрут или данные недоступны, либо доступ ограничен.';
 }
 return error.message;
}
export function matchOperations(a:OperationOut[],b:OperationOut[]){
 const left=new Map(a.map(o=>[o.operationKey,o])),right=new Map(b.map(o=>[o.operationKey,o]));
 return [...new Set([...left.keys(),...right.keys()])].map(key=>{
  const a=left.get(key),b=right.get(key),op=a??b!;
  const candidates=(!a? [...left.values()]:!b?[...right.values()]:[]).filter(other=>op.operationName!==null&&other.operationName===op.operationName&&other.operationType===op.operationType&&other.operationKey!==key);
  const hits=(op:OperationOut)=>JSON.stringify([...op.fields].sort((a,b)=>a.typeName.localeCompare(b.typeName)||a.fieldName.localeCompare(b.fieldName)));
  const changed=Boolean(a&&b&&((['requestCount','countedRequestCount','httpErrorCount','graphqlErrorCount','avgDurationMs'] as const).some(k=>a[k]!==b[k])||hits(a)!==hits(b)));
  return {key,a,b,candidates,changed};
 });
}
export function matchTests(a:ExecutionOut[],b:ExecutionOut[]){
 const groups=new Map<string,{key:string;a:ExecutionOut[];b:ExecutionOut[]}>();
 for(const [side,rows] of [['a',a],['b',b]] as const)for(const row of rows){const key=JSON.stringify([row.framework,row.testId]);const group=groups.get(key)??{key,a:[],b:[]};group[side].push(row);groups.set(key,group)}
 return [...groups.values()];
}
export function safeDocument(row:RequestDetailOut|undefined){
 return row&&(row.documentAvailability==='available'||row.documentAvailability==='redacted')&&typeof row.safeGraphqlDocument==='string'&&row.safeGraphqlDocument.length>0?row.safeGraphqlDocument:null;
}
export function documentDiff(a:string,b:string){
 const left=a.split('\n'),right=b.split('\n');
 // Bound quadratic work for large stored documents. Prefix/suffix diff stays exact
 // about which source each displayed line belongs to, without inventing code.
 if(left.length*right.length>250000){let n=0;while(n<left.length&&n<right.length&&left[n]===right[n])n++;return {left:left.map((text,i)=>({text,changed:i>=n})),right:right.map((text,i)=>({text,changed:i>=n}))}}
 const dp=Array.from({length:left.length+1},()=>new Uint32Array(right.length+1));
 for(let i=left.length-1;i>=0;i--)for(let j=right.length-1;j>=0;j--)dp[i][j]=left[i]===right[j]?dp[i+1][j+1]+1:Math.max(dp[i+1][j],dp[i][j+1]);
 const l=left.map(text=>({text,changed:true})),r=right.map(text=>({text,changed:true}));let i=0,j=0;
 while(i<left.length&&j<right.length){if(left[i]===right[j]){l[i++].changed=false;r[j++].changed=false}else if(dp[i+1][j]>=dp[i][j+1])i++;else j++}
 return {left:l,right:r};
}
