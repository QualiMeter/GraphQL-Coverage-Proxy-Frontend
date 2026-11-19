import {useId,useState} from 'react';
import type {RequestDetail} from '../api/runAnalytics';
import {analyticsError,millis} from './runAnalyticsModel';
import {GraphqlErrorDetails,graphqlErrorSummary} from './GraphqlErrorDetails';
import {RequestFieldEvidence} from './RequestFieldEvidence';
import {RelatedExecution} from './RelatedTestExecutions';
import {CodeView} from './CodeView';
import './requestDetail.css';

type Props={request?:RequestDetail;loading:boolean;error?:Error;snapshotId?:string;scope:string;revision:number;onClose:()=>void;onRetry:()=>void;onOperation:(key:string)=>void;onField:(type:string,field:string)=>void;onTest?:(id:string)=>void};
const analysisLabels:Record<string,string>={success:'Успешно',parse_error:'Ошибка разбора',validation_error:'Ошибка валидации',unsupported:'Не поддерживается',internal_error:'Внутренняя ошибка'};
const yesNo=(value:boolean|null|undefined)=>value==null?'Неизвестно':value?'Да':'Нет';
const tabs=['Обзор','Документ','Поля','Тесты'] as const;

export function RequestDetailPanel(props:Props){
 const {request,onClose}=props;
 const kind=request?.operationType?{query:'Query',mutation:'Mutation',subscription:'Subscription'}[request.operationType]??'Тип неизвестен':'Тип неизвестен';
 return <aside className="detail-panel request-detail-panel" aria-label="Подробности обращения">
  <header className="request-detail-header">
   <div><small>Подробности обращения</small><h2>{request?(request.operationName?.trim()?request.operationName:'Безымянная операция'):'Подробности обращения'}</h2>
    {request&&<p><span>{kind}</span><time dateTime={request.createdAt}>{new Date(request.createdAt).toLocaleString('ru-RU',{dateStyle:'short',timeStyle:'medium'})}</time></p>}
   </div>
   <button type="button" aria-label="Закрыть подробности обращения" onClick={onClose}>×</button>
  </header>
  <RequestDetails key={JSON.stringify([props.scope,props.snapshotId,request?.runId,request?.id])} {...props}/>
 </aside>;
}
function RequestDetails({request,loading,error,snapshotId,scope,revision,onRetry,onOperation,onField,onTest}:Props){
 const [tab,setTab]=useState<typeof tabs[number]>('Обзор');
 const tabId=useId();
 return <>
  {request&&!loading&&!error&&<div className="request-detail-fixed">
   <dl className="request-quick-facts">
    <div data-state={request.httpStatus===null?'unknown':request.httpStatus>=400?'error':request.httpStatus>=200&&request.httpStatus<300?'positive':'neutral'}><dt>HTTP</dt><dd>{request.httpStatus??'Неизвестно'}</dd></div>
    <div data-state={request.graphqlErrorCount==null?'unknown':request.graphqlErrorCount>0?'error':'positive'}><dt>GraphQL</dt><dd>{request.graphqlErrorCount==null?'Неизвестно':graphqlErrorSummary(request)}</dd></div>
    <div><dt>Время</dt><dd>{millis(request.durationMs)}</dd></div>
   </dl>
   <div className="request-detail-tabs" role="tablist" aria-label="Разделы обращения">{tabs.map(name=><button
    key={name} type="button" role="tab" id={tabId+'-'+name} aria-controls={tabId+'-content'} aria-selected={tab===name}
    onClick={()=>setTab(name)}>{name}</button>)}</div>
  </div>}
  <div className="request-detail-body" id={tabId+'-content'} role={request&&!loading&&!error?'tabpanel':undefined} aria-labelledby={request&&!loading&&!error?tabId+'-'+tab:undefined} key={tab}>
   {loading?<p role="status">Загружаем обращение…</p>:error?<div role="alert"><p>{analyticsError(error)}</p><button type="button" className="run-control" onClick={onRetry}>Повторить загрузку обращения</button></div>:request?(
    tab==='Обзор'?<>
     {request.graphqlErrorCount!==0&&<section className="request-diagnostic-section" aria-label="Диагностика GraphQL"><GraphqlErrorDetails info={request}/></section>}
     <section className="request-state"><h3>Состояние обращения</h3><dl>
      <div><dt>Локальный анализ</dt><dd className="request-analysis-state" data-state={request.analysisStatus}>
       <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7">{request.analysisStatus==='success'?<path d="m4 10 4 4 8-8"/>:request.analysisStatus==='unsupported'?<path d="M4 10h12"/>:<><circle cx="10" cy="10" r="7"/><path d="M10 5v6m0 3v.1"/></>}</svg>
       {analysisLabels[request.analysisStatus]??request.analysisStatus}</dd></div>
      <div><dt>Учтено в покрытии</dt><dd>{yesNo(request.countedInCoverage)}</dd></div>
      <div><dt>В ответе есть данные</dt><dd>{yesNo(request.responseHasData)}</dd></div>
      <div><dt>HTTP-метод</dt><dd>{request.httpMethod}</dd></div>
     </dl></section>
     {request.operationKey&&<button type="button" className="run-control request-open-operation" onClick={()=>onOperation(request.operationKey!)}>Открыть операцию</button>}
     <details className="request-extra"><summary>Технические сведения</summary><dl>
      <div><dt>ID обращения</dt><dd><TechnicalValue value={request.id}/></dd></div>
      <div><dt>ID прогона</dt><dd><TechnicalValue value={request.runId}/></dd></div>
      {request.errorCode&&<div><dt>Код локального анализа</dt><dd><code>{request.errorCode}</code></dd></div>}
     </dl></details>
    </>:tab==='Документ'?<section className="request-document"><h3>GraphQL-документ</h3>
     {request.documentAvailability==='redacted'&&<p>Чувствительные значения скрыты сервером.</p>}
     {request.documentAvailability!=='unavailable'&&request.safeGraphqlDocument?<CodeView key={request.id} code={request.safeGraphqlDocument}/>:<p>Безопасный GraphQL-документ недоступен.</p>}
    </section>:tab==='Поля'?<section className="request-fields"><h3>Поля и доказательства <small>({request.selectedFields.length})</small></h3>
     <RequestFieldEvidence key={JSON.stringify(['request-evidence',scope,request.runId,snapshotId,request.id])} request={request} snapshotId={snapshotId} scope={scope} allowed onField={onField}/>
    </section>:<section className="request-related-test"><h3>Связанный E2E-тест</h3>
     <RelatedExecution key={JSON.stringify([scope,request.runId,request.id,request.testExecutionId])} list compact runId={request.runId} executionId={request.testExecutionId} scope={scope} revision={revision} onOpen={onTest}/>
    </section>
   ):<p>Нет данных обращения.</p>}
  </div>
 </>;
}
function TechnicalValue({value}:{value:string}){
 const [status,setStatus]=useState('');
 return <div className="request-technical-value"><code>{value}</code><button type="button" onClick={async()=>{
  try{await navigator.clipboard.writeText(value);setStatus('Скопировано')}
  catch{setStatus('Не удалось скопировать')}
 }}>Копировать</button>{status&&<span role="status">{status}</span>}</div>;
}
