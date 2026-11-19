import {useState} from 'react';
import {getEvidencePage,type FieldEvidencePage} from '../api/fieldEvidence';
import {useComparisonResource} from './useComparisonResource';
import {MetricInfo} from './MetricInfo';
import {EvidenceCounts,EvidenceMeaning,EvidenceWarnings,EvidenceResourceStatus} from './FieldEvidenceUi';
export function FieldResponseEvidence({runId,snapshotId,typeName,fieldName,scope,revision=0,allowed,embedded=false}:{runId?:string|null;snapshotId?:string|null;typeName:string;fieldName:string;scope:string;revision?:number;allowed:boolean;embedded?:boolean}){
 const [open,setOpen]=useState(false);
 const resource=useComparisonResource((open||embedded)&&allowed&&runId&&snapshotId?JSON.stringify([scope,runId,snapshotId,typeName,fieldName,revision]):null,signal=>getEvidencePage(runId!,snapshotId!,{typeName,fieldName},0,signal));
 const page=resource.data;
 const content=!runId?<p>Выберите прогон, чтобы увидеть наличие поля в ответах.</p>:!allowed?<p>Для Field Evidence нужны права доступа к журналу.</p>:!snapshotId?<p>Снимок схемы недоступен.</p>:<><EvidenceResourceStatus loading={resource.loading} error={resource.error} onRetry={resource.retry}/>{page&&<FieldEvidenceResult page={page} compact={embedded}/>}</>;
 if(embedded)return <section className="object-field-evidence"><h3>Наличие поля в ответах <MetricInfo text="Field Evidence показывает присутствие выбранного ключа в ответах, включая null. Не определяет корректность значения, успешность resolver или теста. Coverage Hits учитываются отдельно."/></h3>{content}</section>;
 return <details className="field-response-evidence" open={open} onToggle={e=>setOpen(e.currentTarget.open)}><summary>Наличие поля в ответах</summary>{open&&content}</details>;
}

export function FieldEvidenceResult({page,compact=false}:{page:FieldEvidencePage;compact?:boolean}){
 const row=page.fields[0];
 if(compact)return <>{row?<><p className="object-evidence-total"><strong>{row.observedHits} из {row.selectedRequestCount}</strong> — наблюдалось</p><div className="object-evidence-states">{row.notObservedCount>0&&<span>Не наблюдалось · {row.notObservedCount}</span>}{row.indeterminateCount>0&&<span>Неопределённо · {row.indeterminateCount}</span>}{row.unavailableCount>0&&<span>Недостаточно данных · {row.unavailableCount}</span>}</div></>:<p>В доступных данных нет записей об успешно проанализированном выборе этого поля. Неизвестные выборы нельзя считать отсутствием поля.</p>}<EvidenceWarnings page={page} scopeLabel="весь прогон"/></>;
 return <>{row?<><dl className="evidence-main-counts"><div><dt>Выбрано в запросах</dt><dd>{row.selectedRequestCount}</dd></div><div><dt>Наблюдалось</dt><dd>{row.observedHits}</dd></div></dl><EvidenceCounts observed={row.observedHits} notObserved={row.notObservedCount} indeterminate={row.indeterminateCount} unavailable={row.unavailableCount}/></>:<p>В доступных данных нет записей об успешно проанализированном выборе этого поля. Неизвестные выборы нельзя считать отсутствием поля.</p>}<EvidenceWarnings page={page} scopeLabel="весь прогон"/><EvidenceMeaning/></>;
}
