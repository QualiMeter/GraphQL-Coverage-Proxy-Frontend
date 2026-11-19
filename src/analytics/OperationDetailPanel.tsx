import {useState} from 'react';
import type {OperationOut} from '../api/runAnalytics';
import {millis,operationLabel} from './runAnalyticsModel';
import {OperationIdentity} from './OperationIdentity';

export function OperationDetailPanel({operation,canReadRequests,onClose,onField,onRequests}:{
 operation:OperationOut;canReadRequests:boolean;onClose:()=>void;onField:(type:string,field:string)=>void;onRequests:(key:string)=>void;
}){
 const [tab,setTab]=useState('Обзор');
 const groups=new Map<string,OperationOut['fields']>();
 for(const field of operation.fields)groups.set(field.typeName,[...(groups.get(field.typeName)??[]),field]);
 return <aside className="detail-panel operation-detail" aria-label="Подробности операции">
  <div className="operation-detail-heading">
   <div className="detail-head"><strong>Подробности операции</strong><button type="button" aria-label="Закрыть подробности операции" onClick={onClose}>×</button></div>
   <h2>{operationLabel(operation.operationName)}</h2>
   <OperationIdentity operationKey={operation.operationKey}/>
   <span className="operation-kind" data-kind={operation.operationType}>{operation.operationType==='query'?'Query':operation.operationType==='mutation'?'Mutation':'Subscription'}</span>
   <div className="operation-detail-tabs" role="tablist" aria-label="Разделы операции">{['Обзор','Затронутые поля'].map(name=><button key={name} type="button" role="tab" aria-selected={tab===name} onClick={()=>setTab(name)}>{name}</button>)}</div>
  </div>
  <div className="operation-detail-body">
   {tab==='Обзор'?<>
    <section className="operation-statistics"><strong>{operation.requestCount.toLocaleString('ru-RU')}</strong><span>Обращений</span>
     <p>{operation.countedRequestCount} из {operation.requestCount} учтено в покрытии</p>
     <div><span>HTTP-ошибки <b className={operation.httpErrorCount?'operation-error':undefined}>{operation.httpErrorCount}</b></span><span>GraphQL-ошибки <b className={operation.graphqlErrorCount?'operation-error':undefined}>{operation.graphqlErrorCount}</b></span></div>
    </section>
    <dl className="operation-activity"><div><dt>Среднее время ответа</dt><dd>{millis(operation.avgDurationMs)}</dd></div><div><dt>Последнее обращение</dt><dd>{new Date(operation.lastSeenAt).toLocaleString('ru-RU')}</dd></div></dl>
    <p>Затронуто {operation.fields.length} полей</p>
    {canReadRequests?<button type="button" className="run-control operation-open-requests" onClick={()=>onRequests(operation.operationKey)}>Показать обращения</button>:<p>Журнал доступен пользователям с соответствующими правами.</p>}
   </>:Array.from(groups,([name,fields])=><section className="operation-field-group" key={name}><h3>{name}<small>{fields.length}</small></h3>{fields.map(field=><button type="button" key={field.fieldName} onClick={()=>onField(name,field.fieldName)}><strong>{field.fieldName}</strong><small>{field.hits} Hits</small><span aria-hidden="true">›</span></button>)}</section>)}
   {tab!=='Обзор'&&!operation.fields.length&&<p>Затронутых полей нет.</p>}
  </div>
 </aside>;
}
