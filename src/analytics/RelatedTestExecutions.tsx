import {useState} from 'react';
import {getExecution,listExecutions,type ExecutionOut} from '../api/testCoverage';
import {useComparisonResource} from './useComparisonResource';
import {TestResourceStatus,TestPagination} from './TestCoverageUi';
import {executionStatuses} from './testCoverageModel';
export function ExecutionLink({execution,onOpen}:{execution:ExecutionOut;onOpen?:(id:string)=>void}){
 return <button type="button" className="detail-list-row" disabled={!onOpen} onClick={()=>onOpen?.(execution.id)}>{execution.name} · {executionStatuses[execution.status]} · попытка {execution.attempt} →</button>;
}
export function ExecutionListRow({execution,onOpen}:{execution:ExecutionOut;onOpen?:(id:string)=>void}){
 return <button type="button" disabled={!onOpen} onClick={()=>onOpen?.(execution.id)}>
  <svg className="object-test-status" data-status={execution.status} aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7">{execution.status==='passed'?<path d="m4 10 4 4 8-8"/>:execution.status==='running'?<><circle cx="10" cy="10" r="7"/><path d="M10 5v5l3 2"/></>:execution.status==='skipped'?<path d="M4 10h12"/>:<path d="m5 5 10 10M15 5 5 15"/>}</svg>
  <span><strong>{execution.name}</strong><small>{executionStatuses[execution.status]} · Попытка {execution.attempt}</small></span><span aria-hidden="true">›</span>
 </button>;
}
export function RelatedExecution({runId,executionId,scope,revision=0,onOpen,compact=false,list=false}:{runId:string;executionId:string|null|undefined;scope:string;revision?:number;onOpen?:(id:string)=>void;compact?:boolean;list?:boolean}){
 const resource=useComparisonResource(executionId?JSON.stringify([scope,runId,executionId,revision]):null,signal=>getExecution(runId,executionId!,signal));
 if(executionId===null)return <p>Без привязки к тесту.</p>;
 if(executionId===undefined)return <p>Данные о привязке к тесту недоступны.</p>;
 return <div className="test-request-link">{!compact&&<strong>Связанное выполнение</strong>}<TestResourceStatus resource={resource}/>{resource.data&&(list?<ul className="object-test-list"><li><ExecutionListRow execution={resource.data} onOpen={onOpen}/></li></ul>:<ExecutionLink execution={resource.data} onOpen={onOpen}/>)}</div>;
}
export function FieldTestExecutions({runId,typeName,fieldName,scope,allowed,revision=0,onOpen,embedded=false}:{runId?:string|null;typeName:string;fieldName:string;scope:string;allowed:boolean;revision?:number;onOpen?:(id:string)=>void;embedded?:boolean}){
 const [open,setOpen]=useState(false),[offset,setOffset]=useState(0);
 const resource=useComparisonResource((open||embedded)&&allowed&&runId?JSON.stringify([scope,runId,typeName,fieldName,offset,revision]):null,signal=>listExecutions(runId!,{typeName,fieldName,fieldMode:'covered'},offset,signal));
 const content=!runId?<p>Выберите прогон.</p>:!allowed?<p>Для просмотра тестовых попыток нужны права доступа к Test Coverage.</p>:<><TestResourceStatus resource={resource}/>{resource.data&&<><ul className="object-test-list">{resource.data.rows.map(t=><li key={t.id}><ExecutionListRow execution={t} onOpen={onOpen}/></li>)}</ul>{!resource.data.rows.length&&<p>Нет зарегистрированных выполнений с учтённым покрытием этого поля. Это не доказывает, что тесты не запускались.</p>}<TestPagination page={resource.data} offset={offset} size={50} onPage={setOffset}/></>}</>;
 if(embedded)return <section className="object-field-tests"><h3>Тесты, покрывавшие поле</h3>{content}</section>;
 return <details className="field-test-executions" open={open} onToggle={e=>setOpen(e.currentTarget.open)}><summary>Тесты, покрывавшие поле</summary>{open&&(!runId?<p>Выберите прогон.</p>:!allowed?<p>Для просмотра тестовых попыток нужны права доступа к Test Coverage.</p>:<><TestResourceStatus resource={resource}/>{resource.data&&<><ul className="test-fields-list">{resource.data.rows.map(t=><li key={t.id}><ExecutionLink execution={t} onOpen={onOpen}/></li>)}</ul>{!resource.data.rows.length&&<p>Нет зарегистрированных выполнений с учтённым покрытием этого поля. Это не доказывает, что тесты не запускались.</p>}<TestPagination page={resource.data} offset={offset} size={50} onPage={setOffset}/></>}</>)}</details>;
}
