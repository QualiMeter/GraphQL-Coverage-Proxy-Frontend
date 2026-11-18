import {requestJson} from './client';
export type SchemaCoordinate={typeName:string;fieldName:string};
export type QueryPath={path:SchemaCoordinate[];pathHits:number};
export type RunPaths={runId:string;snapshotId:string;pathDataAvailability:'available'|'partial'|'unavailable';maxDepth:number|null;paths:{total:number;items:QueryPath[]};relations:{total:number;items:{fromType:string;fieldName:string;toType:string;relationHits:number}[]}};
const object=(v:unknown):v is Record<string,unknown>=>Boolean(v&&typeof v==='object'&&!Array.isArray(v));
const count=(v:unknown)=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0;
const name=(v:unknown)=>typeof v==='string'&&/^[_A-Za-z][_0-9A-Za-z]*$/.test(v);
export function getRunPaths(runId:string,snapshotId:string,field:SchemaCoordinate,offset:number,signal?:AbortSignal){
 const params=new URLSearchParams({typeName:field.typeName,fieldName:field.fieldName,limit:'50',offset:String(offset)});
 return requestJson(`/api/runs/${encodeURIComponent(runId)}/paths?${params}`,data=>{
  if(!object(data)||data.runId!==runId||data.snapshotId!==snapshotId||!['available','partial','unavailable'].includes(String(data.pathDataAvailability))||!(data.maxDepth===null||count(data.maxDepth))||!object(data.paths)||!count(data.paths.total)||!Array.isArray(data.paths.items)||data.paths.items.length>50||!data.paths.items.every(row=>object(row)&&count(row.pathHits)&&Array.isArray(row.path)&&row.path.length>0&&row.path.every(c=>object(c)&&name(c.typeName)&&name(c.fieldName))&&row.path.at(-1)?.typeName===field.typeName&&row.path.at(-1)?.fieldName===field.fieldName)||!object(data.relations)||!count(data.relations.total)||!Array.isArray(data.relations.items)||!data.relations.items.every(r=>object(r)&&name(r.fromType)&&name(r.fieldName)&&name(r.toType)&&count(r.relationHits)))throw new Error('Expected RunPathsOut for the selected run, snapshot and terminal field');
  return data as RunPaths;
 },{signal});
}
export const pathLabel=(path:readonly SchemaCoordinate[])=>path.map(c=>`${c.typeName}.${c.fieldName}`).join(' → ');
