import {useState} from 'react';
import {getEvidencePage,type FieldEvidencePage} from '../api/fieldEvidence';
import {useComparisonResource} from './useComparisonResource';
import {EvidenceCounts,EvidenceMeaning,EvidenceWarnings,EvidenceResourceStatus} from './FieldEvidenceUi';
export function FieldResponseEvidence({runId,snapshotId,typeName,fieldName,scope,revision=0,allowed}:{runId?:string|null;snapshotId?:string|null;typeName:string;fieldName:string;scope:string;revision?:number;allowed:boolean}){
 const [open,setOpen]=useState(false);
 const resource=useComparisonResource(open&&allowed&&runId&&snapshotId?JSON.stringify([scope,runId,snapshotId,typeName,fieldName,revision]):null,signal=>getEvidencePage(runId!,snapshotId!,{typeName,fieldName},0,signal));
 const page=resource.data;
 return <details className="field-response-evidence" open={open} onToggle={e=>setOpen(e.currentTarget.open)}><summary>Наличие поля в ответах</summary>{open&&(!runId?<p>Выберите прогон, чтобы увидеть наличие поля в ответах.</p>:!allowed?<p>Для Field Evidence нужны права доступа к журналу.</p>:!snapshotId?<p>Снимок схемы недоступен.</p>:<><EvidenceResourceStatus loading={resource.loading} error={resource.error} onRetry={resource.retry}/>{page&&<FieldEvidenceResult page={page}/>}</>)}</details>;
}

export function FieldEvidenceResult({page}:{page:FieldEvidencePage}){
 const row=page.fields[0];
 return <>{row?<><dl className="evidence-main-counts"><div><dt>Выбрано в запросах</dt><dd>{row.selectedRequestCount}</dd></div><div><dt>Наблюдалось</dt><dd>{row.observedHits}</dd></div></dl><EvidenceCounts observed={row.observedHits} notObserved={row.notObservedCount} indeterminate={row.indeterminateCount} unavailable={row.unavailableCount}/></>:<p>В доступных данных нет записей об успешно проанализированном выборе этого поля. Неизвестные выборы нельзя считать отсутствием поля.</p>}<EvidenceWarnings page={page} scopeLabel="весь прогон"/><EvidenceMeaning/></>;
}
