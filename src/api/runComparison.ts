import {requestJson} from './client';
import {validGraphqlErrors} from './graphqlErrors';
import {comparisonSchemas} from './comparisonSchemas';
import type {RunComparisonRequest,RunComparisonResponse,FieldEvidencePage,ExecutionOut,ExecutionFieldOut,RequestDetailOut} from './comparisonDtos';
export type {RunComparisonRequest,RunComparisonResponse,ComparedFieldOut,ComparedTypeOut,RunMetricOut,ExecutionOut,RequestDetailOut} from './comparisonDtos';

type Schema={type?:string;$ref?:string;required?:string[];properties?:Record<string,Schema>;items?:Schema;anyOf?:Schema[];enum?:unknown[];const?:unknown;minimum?:number;maximum?:number;minItems?:number;maxItems?:number;format?:string;additionalProperties?:boolean|Schema};
const schemas:Record<string,Schema>=comparisonSchemas;
export function matchesSchema(value:unknown,schema:Schema):boolean {
 if(schema.$ref)return matchesSchema(value,schemas[schema.$ref.split('/').at(-1)!]);
 if(schema.anyOf)return schema.anyOf.some(s=>matchesSchema(value,s));
 if(schema.enum&&!schema.enum.includes(value))return false;
 if('const' in schema&&value!==schema.const)return false;
 if(schema.type==='null')return value===null;
 if(schema.type==='string')return typeof value==='string'&&(schema.format!=='uuid'||/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(value))&&(schema.format!=='date-time'||Number.isFinite(Date.parse(value)));
 if(schema.type==='number'||schema.type==='integer')return typeof value==='number'&&Number.isFinite(value)&&(schema.type!=='integer'||Number.isInteger(value))&&(schema.minimum===undefined||value>=schema.minimum)&&(schema.maximum===undefined||value<=schema.maximum);
 if(schema.type==='boolean')return typeof value==='boolean';
 if(schema.type==='array')return Array.isArray(value)&&(schema.minItems===undefined||value.length>=schema.minItems)&&(schema.maxItems===undefined||value.length<=schema.maxItems)&&value.every(v=>matchesSchema(v,schema.items??{}));
 if(schema.type==='object'){
  if(!value||typeof value!=='object'||Array.isArray(value))return false;
  const row=value as Record<string,unknown>;
  return (schema.required??[]).every(k=>k in row)&&Object.entries(row).every(([k,v])=>schema.properties?.[k]?matchesSchema(v,schema.properties[k]):schema.additionalProperties!==false&&(typeof schema.additionalProperties!=='object'||matchesSchema(v,schema.additionalProperties)));
 }
 return true;
}
function decode<T>(name:keyof typeof comparisonSchemas,value:unknown):T {
 if(!matchesSchema(value,schemas[name]))throw new Error(`Expected ${name}`);
 return value as T;
}
export function compareRuns(body:RunComparisonRequest,csrfToken?:string,signal?:AbortSignal){
 decode('RunComparisonRequest',body);
 if(new Set(body.runIds).size!==body.runIds.length||!body.runIds.includes(body.baselineRunId)||!body.targetRunId||!body.runIds.includes(body.targetRunId)||body.baselineRunId===body.targetRunId)throw new Error('Некорректный выбор baseline/target.');
 return requestJson('/api/runs/compare',data=>{
  const result=decode<RunComparisonResponse>('RunComparisonResponse',data);
  const ids=result.runs.map(r=>r.runId),sameIds=(values:string[])=>values.length===ids.length&&new Set(values).size===ids.length&&values.every(id=>ids.includes(id));
  if(!sameIds(body.runIds)||result.baselineRunId!==body.baselineRunId||result.targetRunId!==body.targetRunId||result.fields.items.length>(body.fields?.limit??100)||result.types.items.length>(body.types?.limit??100)||
   result.fields.items.some(f=>!sameIds(f.hitsByRun.map(r=>r.runId)))||result.types.items.some(t=>!sameIds(t.runs.map(r=>r.runId))))throw new Error('Comparison context mismatch');
  const adjacent=result.comparison.adjacentCoverageDeltasPp;
  if(adjacent.length!==ids.length-1||adjacent.some((d,i)=>d.fromRunId!==ids[i]||d.toRunId!==ids[i+1]||typeof d.deltaPp!=='number'||!Number.isFinite(d.deltaPp)))throw new Error('Invalid adjacent transitions');
  return result;
 },{method:'POST',body,csrfToken,signal,readErrorCode:true});
}
const path=(runId:string)=>`/api/runs/${encodeURIComponent(runId)}` as const;
const params=(query:Record<string,string|number>)=>new URLSearchParams(Object.entries(query).map(([k,v])=>[k,String(v)]));
export function getFieldEvidence(runId:string,typeName:string,fieldName:string,signal?:AbortSignal){
 return requestJson(`${path(runId)}/field-evidence?${params({typeName,fieldName,limit:50,offset:0})}`,data=>{
  const page=decode<FieldEvidencePage>('FieldEvidencePage',data);
  if(page.runId!==runId||page.fields.some(f=>f.typeName!==typeName||f.fieldName!==fieldName))throw new Error('Evidence context mismatch');
  return page;
 },{signal});
}
function page<T>(name:keyof typeof comparisonSchemas,data:unknown,response:Response,offset:number,check:(row:T)=>boolean){
 if(!Array.isArray(data))throw new Error('Expected array');
 const rows=data.map(v=>decode<T>(name,v));
 if(!rows.every(check))throw new Error('Detail context mismatch');
 const count=response.headers.get('X-Total-Count');
 return {rows,more:count!==null&&/^\d+$/.test(count)?offset+rows.length<Number(count):rows.length===50};
}
export function getTests(runId:string,typeName:string,fieldName:string,fieldMode:'covered'|'selected'|'observed',offset:number,signal?:AbortSignal){
 return requestJson(`${path(runId)}/tests?${params({typeName,fieldName,fieldMode,limit:50,offset})}`,(data,response)=>page<ExecutionOut>('ExecutionOut',data,response,offset,r=>r.runId===runId),{signal});
}
export function getTestDetail(runId:string,id:string,signal?:AbortSignal){
 return requestJson(`${path(runId)}/tests/${encodeURIComponent(id)}`,data=>{const row=decode<ExecutionOut>('ExecutionOut',data);if(row.runId!==runId||row.id!==id)throw new Error('Test context mismatch');return row},{signal});
}
export function getTestFields(runId:string,id:string,offset:number,signal?:AbortSignal){
 return requestJson(`${path(runId)}/tests/${encodeURIComponent(id)}/fields?${params({limit:50,offset})}`,(data,response)=>page<ExecutionFieldOut>('ExecutionFieldOut',data,response,offset,()=>true),{signal});
}
export function getComparisonRequest(runId:string,id:string,signal?:AbortSignal){
 return requestJson(`${path(runId)}/requests/${encodeURIComponent(id)}`,data=>{const row=decode<RequestDetailOut>('RequestDetailOut',data);if(row.runId!==runId||row.id!==id||!validGraphqlErrors(row))throw new Error('Request context mismatch or invalid GraphQL diagnostics');return row},{signal});
}
