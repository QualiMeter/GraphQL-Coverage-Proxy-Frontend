import {requestJson} from './client';
import {matchesSchema} from './runComparison';
import {comparisonSchemas} from './comparisonSchemas';
import type {FieldEvidencePage,FieldEvidenceOut} from './comparisonDtos';
export type {FieldEvidencePage,FieldEvidenceOut} from './comparisonDtos';
export type EvidenceState='observed'|'not_observed'|'indeterminate'|'unavailable';
export type EvidenceQuery={requestId:string;typeName?:never;fieldName?:never}|{requestId?:never;typeName:string;fieldName:string};
const counters=['selectedRequestCount','selectedHits','observedHits','notObservedCount','indeterminateCount','unavailableCount'] as const;
const count=(n:number)=>Number.isSafeInteger(n)&&n>=0;
export function decodeEvidence(data:unknown,runId:string,snapshotId:string,query:EvidenceQuery,offset:number):FieldEvidencePage {
 if(!matchesSchema(data,comparisonSchemas.FieldEvidencePage))throw new Error('Expected FieldEvidencePage');
 const page=data as FieldEvidencePage;
 if(page.runId!==runId||page.snapshotId!==snapshotId||page.offset!==offset||page.limit!==100||page.fields.length>100||![page.requestCount,page.selectionUnavailableRequestCount,page.evidenceUnavailableRequestCount,page.total,page.offset].every(count)||page.selectionUnavailableRequestCount>page.requestCount||page.evidenceUnavailableRequestCount>page.requestCount||page.fields.length>page.total)throw new Error('Field Evidence context or page mismatch');
 if(query.requestId!==undefined&&page.requestCount!==1)throw new Error('Expected evidence for one request');
 const coordinates=new Set<string>();
 for(const field of page.fields){
  const key=`${field.typeName}.${field.fieldName}`;
  if(coordinates.has(key)||!counters.every(k=>count(field[k]))||field.selectedRequestCount!==field.observedHits+field.notObservedCount+field.indeterminateCount+field.unavailableCount||field.selectedHits>field.selectedRequestCount||field.selectedRequestCount>page.requestCount)throw new Error('Invalid evidence counts or repeated coordinate');
  coordinates.add(key);
  if(query.requestId!==undefined&&(field.selectedRequestCount!==1||!counters.every(k=>field[k]<=1)))throw new Error('Expected per-request evidence counters');
  if(query.typeName!==undefined&&(field.typeName!==query.typeName||field.fieldName!==query.fieldName))throw new Error('Evidence belongs to another coordinate');
 }
 return page;
}
export function getEvidencePage(runId:string,snapshotId:string,query:EvidenceQuery,offset=0,signal?:AbortSignal){
 if(!Number.isSafeInteger(offset)||offset<0)throw new Error('Некорректная страница Field Evidence.');
 const params=new URLSearchParams({limit:'100',offset:String(offset)});
 if(query.requestId!==undefined)params.set('requestId',query.requestId);
 else {params.set('typeName',query.typeName);params.set('fieldName',query.fieldName)}
 return requestJson(`/api/runs/${encodeURIComponent(runId)}/field-evidence?${params}`,data=>decodeEvidence(data,runId,snapshotId,query,offset),{signal});
}
export function requestEvidenceState(row:FieldEvidenceOut|undefined):EvidenceState {
 if(!row||row.selectedRequestCount!==1)return 'unavailable';
 const states:[EvidenceState,number][]=[['observed',row.observedHits],['not_observed',row.notObservedCount],['indeterminate',row.indeterminateCount],['unavailable',row.unavailableCount]];
 if(!states.every(([,n])=>n===0||n===1)||states.reduce((sum,[,n])=>sum+n,0)!==1)return 'unavailable';
 return states.find(([,n])=>n===1)![0];
}
