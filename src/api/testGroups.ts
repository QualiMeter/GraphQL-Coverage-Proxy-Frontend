import {requestJson} from './client';
export type GroupDimension='team'|'suite';
export type TestGroupFilters={teamKey?:string;suiteKey?:string;unassignedTeam?:boolean;unassignedSuite?:boolean};
export type TestGroup={key:string|null;totalTests:number;totalExecutions:number;requestCount:number;selectedFieldCount:number;coveredFieldCount:number;observedFieldCount:number;unavailableEvidenceRequestCount:number;totalFields:number;coveragePercent:number};
const object=(value:unknown):value is Record<string,unknown>=>Boolean(value)&&typeof value==='object'&&!Array.isArray(value);
export function validateGroupFilters(query:TestGroupFilters){
 if(query.teamKey!==undefined&&query.unassignedTeam||query.suiteKey!==undefined&&query.unassignedSuite)throw new Error('Выберите ключ группы или «Без группы».');
 for(const key of [query.teamKey,query.suiteKey])if(key!==undefined&&(typeof key!=='string'||!key.length||key.length>128))throw new Error('Некорректный ключ группы.');
}
export function listTestGroups(runId:string,groupBy:GroupDimension,offset:number,signal?:AbortSignal){
 if(!Number.isSafeInteger(offset)||offset<0)throw new Error('Некорректная страница групп.');
 const params=new URLSearchParams({groupBy,limit:'100',offset:String(offset)});
 return requestJson(`/api/runs/${encodeURIComponent(runId)}/test-coverage/groups?${params}`,(data,response)=>{
  const counts=['totalTests','totalExecutions','requestCount','selectedFieldCount','coveredFieldCount','observedFieldCount','unavailableEvidenceRequestCount','totalFields'];
  if(!Array.isArray(data)||data.length>100||!data.every(row=>object(row)&&(row.key===null||typeof row.key==='string'&&row.key.length>0&&row.key.length<=128)&&counts.every(key=>typeof row[key]==='number'&&Number.isSafeInteger(row[key])&&row[key]>=0)&&typeof row.coveragePercent==='number'&&Number.isFinite(row.coveragePercent)&&row.coveragePercent>=0&&row.coveragePercent<=100))throw new Error('API вернул некорректный список групп тестов.');
  const header=response.headers.get('X-Total-Count'),total=header!==null&&/^\d+$/.test(header)&&Number.isSafeInteger(Number(header))?Number(header):null;
  return {rows:data as TestGroup[],total,more:total===null?data.length===100:offset+data.length<total};
 },{signal});
}
export async function getTestGroupKeys(runId:string,groupBy:GroupDimension,signal:AbortSignal){
 const keys=new Set<string>();let offset=0;
 while(true){
  if(signal.aborted)throw new DOMException('Загрузка групп отменена','AbortError');
  const page=await listTestGroups(runId,groupBy,offset,signal);
  if(signal.aborted)throw new DOMException('Загрузка групп отменена','AbortError');
  for(const row of page.rows)if(row.key!==null)keys.add(row.key);
  if(!page.more)return [...keys];
  if(!page.rows.length)throw new Error('Список групп изменился при загрузке. Обновите список.');
  offset+=page.rows.length;
 }
}
