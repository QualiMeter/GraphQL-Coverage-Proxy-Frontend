import type { Coverage, Field, SchemaType } from '../model';
import { mockCoverage } from './mock';
export type Scenario='final'|'first'|'empty';
export interface DataSource { load(scenario:Scenario):Promise<Coverage> }
const object=(v:unknown):v is Record<string,unknown>=>typeof v==='object'&&v!==null&&!Array.isArray(v);
const number=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)?v:0;
function normalize(v:unknown):Coverage {
 if(!object(v)||!object(v.summary)||!Array.isArray(v.types)) throw new Error('Некорректный ответ API покрытия');
 const types:SchemaType[]=v.types.map((item:unknown)=>{if(!object(item)||typeof item.name!=='string'||!Array.isArray(item.fields)) throw new Error('Некорректная структура типов');
  const fields:Field[]=item.fields.map((entry:unknown)=>{if(!object(entry)||typeof entry.name!=='string'||typeof entry.returnType!=='string') throw new Error('Некорректная структура полей');return {name:entry.name,returnType:entry.returnType,targetType:typeof entry.targetType==='string'?entry.targetType:null,covered:entry.covered===true,hits:number(entry.hits),deprecated:entry.deprecated===true}});
  return {name:item.name,kind:typeof item.kind==='string'?item.kind:'OBJECT',role:item.role==='query'||item.role==='mutation'?item.role:undefined,fields,totalFields:number(item.totalFields),coveredFields:number(item.coveredFields),coveragePercent:number(item.coveragePercent)};
 });
 const summary=v.summary;
 return {service:typeof v.service==='string'?v.service:'Сервис',schemaId:typeof v.schemaId==='string'?v.schemaId:'',runId:typeof v.runId==='string'?v.runId:null,summary:{totalFields:number(summary.totalFields),coveredFields:number(summary.coveredFields),coveragePercent:number(summary.coveragePercent)},types};
}
export const mockSource:DataSource={load:async scenario=>mockCoverage(scenario)};
// The published OpenAPI could not be reached from this environment. No route is guessed.
export const apiSource:DataSource={load:async()=>{const base=import.meta.env.VITE_API_BASE_URL;if(!base) throw new Error('Укажите VITE_API_BASE_URL');const route=import.meta.env.VITE_COVERAGE_PATH;if(!route) throw new Error('Маршрут покрытия не подтверждён OpenAPI. Укажите VITE_COVERAGE_PATH после сверки контракта.');const response=await fetch(new URL(route,base));if(!response.ok) throw new Error(`HTTP ${response.status}`);return normalize(await response.json())}};
