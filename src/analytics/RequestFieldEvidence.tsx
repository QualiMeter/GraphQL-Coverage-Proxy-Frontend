import {useState} from 'react';
import {getEvidencePage,requestEvidenceState,type FieldEvidenceOut} from '../api/fieldEvidence';
import type {RequestDetail} from '../api/runAnalytics';
import {useComparisonResource} from './useComparisonResource';
import {EvidenceBadge,EvidenceMeaning,EvidenceResourceStatus,EvidenceWarnings} from './FieldEvidenceUi';

export function RequestFieldLink({field,evidence,loaded,loading,onField}:{field:RequestDetail['selectedFields'][number];evidence?:FieldEvidenceOut;loaded:boolean;loading:boolean;onField:(type:string,field:string)=>void}){
 const state=evidence?requestEvidenceState(evidence):loading?'loading':loaded?'unavailable':'not_loaded';
 return <button type="button" className="detail-list-row evidence-field-link" onClick={()=>onField(field.typeName,field.fieldName)}><span>{field.typeName}.{field.fieldName}{field.returnType&&<small>{field.returnType}</small>}</span><EvidenceBadge state={state} note={!evidence&&loaded?'Evidence для этой координаты не возвращён. Присутствие поля неизвестно.':undefined}/><span className="request-field-arrow" aria-hidden="true">›</span></button>;
}
export function RequestFieldEvidence({request,snapshotId,scope,allowed,onField}:{request:RequestDetail;snapshotId?:string;scope:string;allowed:boolean;onField:(type:string,field:string)=>void}){
 const [offset,setOffset]=useState(0),[previous,setPrevious]=useState<FieldEvidenceOut[]>([]);
 const resource=useComparisonResource(allowed&&snapshotId?JSON.stringify([scope,request.runId,snapshotId,request.id,offset]):null,signal=>getEvidencePage(request.runId,snapshotId!,{requestId:request.id},offset,signal));
 const page=resource.data;
 const rows=[...new Map([...previous,...(page?.fields??[])].map(row=>[`${row.typeName}.${row.fieldName}`,row])).values()];
 const byCoordinate=new Map(rows.map(row=>[`${row.typeName}.${row.fieldName}`,row]));
 const complete=Boolean(page&&offset+page.fields.length>=page.total);
 return <>{!allowed?<p>Для Field Evidence нужны права доступа к журналу.</p>:!snapshotId?<p>Не выбран снимок схемы для проверки Evidence.</p>:<EvidenceResourceStatus loading={resource.loading} error={resource.error} onRetry={resource.retry}/>}
  {request.selectedFields.map(field=><RequestFieldLink key={`${field.typeName}.${field.fieldName}`} field={field} evidence={byCoordinate.get(`${field.typeName}.${field.fieldName}`)} loaded={complete} loading={resource.loading} onField={onField}/>)}
  {!request.selectedFields.length&&<p>{request.analysisStatus!=='success'?'Анализ выбранных полей недоступен: обращение не было успешно проанализировано.':'Нет сохранённого списка выбранных полей этого обращения.'}</p>}
  {page&&<EvidenceWarnings page={page} scopeLabel="это обращение"/>}
  {page&&!complete&&<button type="button" className="run-control" disabled={resource.loading} onClick={()=>{setPrevious(rows);setOffset(offset+100)}}>Загрузить ещё Evidence ({rows.length} из {page.total})</button>}
  <EvidenceMeaning/>
 </>;
}
