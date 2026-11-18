import {zip} from 'fflate';
import {exportError,fetchExport,MAX_EXPORT_BYTES,type ExportFormat} from './download';
import type {RunComparisonRequest} from './comparisonDtos';
export const datasetLabels={coverage:'Схема и покрытие',operations:'Операции',requests:'Обращения',tests:'Тесты','test-matrix':'Матрица тестов'};
export type Dataset=keyof typeof datasetLabels;
export type ExportFilters=Partial<Record<Dataset,Record<string,string|number|boolean|undefined>>>;
export type ComparisonExport={request:RunComparisonRequest;snapshotId:string;names:string[]};
export type ExportJob={runId:string;snapshotId:string;serviceId:string;format:ExportFormat;datasets:Dataset[];filters:ExportFilters;comparison?:ComparisonExport;csrfToken?:string};
function checkAbort(signal:AbortSignal){if(signal.aborted)throw new DOMException('Экспорт отменён','AbortError')}
export function comparisonExportBody(request:RunComparisonRequest,filtered:boolean):RunComparisonRequest{return {runIds:[...request.runIds],baselineRunId:request.baselineRunId,targetRunId:request.targetRunId,fields:{filter:filtered?request.fields?.filter??'all':'all'}}}
const object=(value:unknown):value is Record<string,unknown>=>Boolean(value)&&typeof value==='object'&&!Array.isArray(value);
function decodeDocument(bytes:Uint8Array,dataset:string,job:ExportJob){
 const data:unknown=JSON.parse(new TextDecoder().decode(bytes));
 if(!object(data)||data.formatVersion!==1||data.dataset!==dataset||!object(data.metadata)||!object(data.metadata.snapshot)||data.metadata.snapshot.id!==job.snapshotId||!object(data.metadata.service)||data.metadata.service.id!==job.serviceId||!Array.isArray(data.metadata.runs)||!object(data.filters)||!object(data.summary)||!Array.isArray(data.rows)||data.rowCount!==data.rows.length)throw new Error('Файл экспорта не соответствует выбранному контексту или формату.');
 const ids=data.metadata.runs.map(run=>object(run)?run.id:undefined),expected=job.comparison?.request.runIds??[job.runId];
 if(ids.length!==expected.length||!expected.every(id=>ids.includes(id)))throw new Error('Файл относится к другим прогонам.');
 return data;
}
export async function prepareExport(job:ExportJob,signal:AbortSignal,onProgress:(message:string)=>void){
 const datasets=job.comparison?['comparison'] as const:job.datasets;
 if(!datasets.length)throw new Error('Выберите хотя бы один набор.');
 const files:Record<string,Uint8Array>={},documents:Record<string,unknown>={};let totalBytes=0,filename='';
 for(const dataset of datasets){
  checkAbort(signal);onProgress(`Подготовка экспорта: ${dataset==='comparison'?'сравнение прогонов':datasetLabels[dataset]}…`);
  const params=new URLSearchParams({format:job.format});
  if(dataset!=='comparison')for(const [key,value] of Object.entries(job.filters[dataset]??{}))if(value!==undefined&&key!=='limit'&&key!=='offset')params.set(key,String(value));
  const path=dataset==='comparison'?`/api/runs/compare/export?${params}` as const:`/api/runs/${encodeURIComponent(job.runId)}/exports/${dataset}?${params}` as const;
  try{
   const file=await fetchExport(path,{format:job.format,fallback:`${dataset}-${dataset==='comparison'?job.comparison!.request.baselineRunId:job.runId}.${job.format}`,signal,body:dataset==='comparison'?comparisonExportBody(job.comparison!.request,true):undefined,csrfToken:job.csrfToken,maxBytes:MAX_EXPORT_BYTES-totalBytes});
   checkAbort(signal);totalBytes+=file.bytes.byteLength;filename=file.filename;
   if(job.format==='json')documents[dataset==='test-matrix'?'testMatrix':dataset]=decodeDocument(file.bytes,dataset,job);
   files[`${dataset}.${job.format}`]=file.bytes;
  }catch(error){checkAbort(signal);throw new Error(`${dataset==='comparison'?'Сравнение прогонов':datasetLabels[dataset]}: ${exportError(error)}`,{cause:error})}
  onProgress(`Получено ${Object.keys(files).length} из ${datasets.length} наборов…`);
 }
 checkAbort(signal);
 if(datasets.length===1)return {bytes:Object.values(files)[0],filename,type:job.format==='csv'?'text/csv;charset=utf-8':'application/json'};
 if(job.format==='json'){
  onProgress('Формирование объединённого JSON…');
  const bytes=new TextEncoder().encode(JSON.stringify({bundleVersion:1,runId:job.runId,datasets:documents}));
  if(bytes.byteLength>MAX_EXPORT_BYTES)throw new Error('Объединённый JSON превышает лимит браузера 32 МиБ. Выберите меньше наборов.');
  checkAbort(signal);return {bytes,filename:`analytics-${job.runId}.json`,type:'application/json'};
 }
 onProgress('Формирование архива…');
 const bytes=await new Promise<Uint8Array>((resolve,reject)=>{let terminate=()=>{};const abort=()=>{terminate();reject(new DOMException('Экспорт отменён','AbortError'))};signal.addEventListener('abort',abort,{once:true});terminate=zip(files,{level:0},(error,result)=>{signal.removeEventListener('abort',abort);if(error)reject(new Error('Не удалось сформировать ZIP-архив.',{cause:error}));else resolve(result)});if(signal.aborted)abort()});
 checkAbort(signal);return {bytes,filename:`analytics-${job.runId}.zip`,type:'application/zip'};
}
