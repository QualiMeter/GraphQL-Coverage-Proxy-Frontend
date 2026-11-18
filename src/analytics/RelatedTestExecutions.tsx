import {useState} from 'react';
import {getExecution,listExecutions,type ExecutionOut} from '../api/testCoverage';
import {useComparisonResource} from './useComparisonResource';
import {TestResourceStatus,TestPagination} from './TestCoverageUi';
import {executionStatuses} from './testCoverageModel';
export function ExecutionLink({execution,onOpen}:{execution:ExecutionOut;onOpen?:(id:string)=>void}){
 return <button type="button" className="detail-list-row" disabled={!onOpen} onClick={()=>onOpen?.(execution.id)}>{execution.name} · {executionStatuses[execution.status]} · попытка {execution.attempt} →</button>;
}
export function RelatedExecution({runId,executionId,scope,revision=0,onOpen,compact=false}:{runId:string;executionId:string|null|undefined;scope:string;revision?:number;onOpen?:(id:string)=>void;compact?:boolean}){
 const resource=useComparisonResource(executionId?JSON.stringify([scope,runId,executionId,revision]):null,signal=>getExecution(runId,executionId!,signal));
 if(executionId===null)return <p>Без привязки к тесту.</p>;
 if(executionId===undefined)return <p>Данные о привязке к тесту недоступны.</p>;
 return <div className="test-request-link">{!compact&&<strong>Связанное выполнение</strong>}<TestResourceStatus resource={resource}/>{resource.data&&<ExecutionLink execution={resource.data} onOpen={onOpen}/>}</div>;
}
export function FieldTestExecutions({runId,typeName,fieldName,scope,allowed,revision=0,onOpen}:{runId?:string|null;typeName:string;fieldName:string;scope:string;allowed:boolean;revision?:number;onOpen?:(id:string)=>void}){
 const [open,setOpen]=useState(false),[offset,setOffset]=useState(0);
 const resource=useComparisonResource(open&&allowed&&runId?JSON.stringify([scope,runId,typeName,fieldName,offset,revision]):null,signal=>listExecutions(runId!,{typeName,fieldName,fieldMode:'covered'},offset,signal));
 return <details className="field-test-executions" open={open} onToggle={e=>setOpen(e.currentTarget.open)}><summary>Тесты, покрывавшие поле</summary>{open&&(!runId?<p>Выберите прогон.</p>:!allowed?<p>Для просмотра тестовых попыток нужны права доступа к Test Coverage.</p>:<><TestResourceStatus resource={resource}/>{resource.data&&<><ul className="test-fields-list">{resource.data.rows.map(t=><li key={t.id}><ExecutionLink execution={t} onOpen={onOpen}/></li>)}</ul>{!resource.data.rows.length&&<p>Нет зарегистрированных выполнений с учтённым покрытием этого поля. Это не доказывает, что тесты не запускались.</p>}<TestPagination page={resource.data} offset={offset} size={50} onPage={setOffset}/></>}</>)}</details>;
}
