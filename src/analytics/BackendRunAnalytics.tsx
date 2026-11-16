import {useCallback, useMemo, useState} from 'react';
import {getFilteredJournal, getOperations, getRequestDetail, journalPageSize, type JournalQuery, type RunStats} from '../api/runAnalytics';
import type {GraphType} from '../model';
import {useBackendRead} from './useBackendRead';
import {analyticsError, analysisErrors, matchesOperation, mayReadJournal, millis, operationLabel} from './runAnalyticsModel';
import {CodeView} from './CodeView';

type Props = {
  runId: string; scope: string; revision: number; role?: string;
  field: string; operationKey: string; filter: string; sort: string; types: GraphType[]; stats?: RunStats;
  onField: (type: string, field: string) => void;
  onRequests: (key: string) => void;
  onOperation: (key: string) => void;
  onClearContext: () => void;
};
const analysisLabels: Record<string, string> = {success:'Успешно',parse_error:'Ошибка разбора',validation_error:'Ошибка валидации',unsupported:'Не поддерживается',internal_error:'Внутренняя ошибка'};
const date = (v: string) => new Date(v).toLocaleString('ru-RU', {dateStyle:'short', timeStyle:'short'});
const yesNo = (v: boolean | null) => v === null ? '—' : v ? 'Да' : 'Нет';

function Result({loading,error,empty}:{loading:boolean;error?:Error;empty:string}) {
  return <div className="empty-state" role={error?'alert':'status'}>{loading?'Загрузка…':error?analyticsError(error):empty}</div>;
}

function Stats({stats}:{stats:RunStats}) {
  return <details className="run-statistics"><summary>Статистика прогона</summary>
    <p>Учтено в покрытии: {stats.countedRequests} из {stats.totalRequests}. Query: {stats.queryRequests}, Mutation: {stats.mutationRequests}, Subscription: {stats.subscriptionRequests}.</p>
    <p>Покрытие: {stats.coveragePercent.toFixed(2)}% ({stats.coveredFields} из {stats.totalFields}).</p>
    <p>Ошибки анализа: {analysisErrors(stats)??'—'}. Не поддерживается: {stats.analysisStatusCounts?.unsupported??'—'}.</p>
    {stats.requestTimeline.length>0&&<div className="table-scroll"><table aria-label="Статистика по минутам">
      <thead><tr><th>Начало минуты</th><th>Обращений</th><th>Учтено</th><th>HTTP</th><th>GraphQL</th><th>Среднее</th></tr></thead>
      <tbody>{stats.requestTimeline.map(bucket=><tr key={bucket.bucketStart}><td>{date(bucket.bucketStart)}</td><td>{bucket.requestCount}</td><td>{bucket.countedRequestCount}</td><td>{bucket.httpErrorCount}</td><td>{bucket.graphqlErrorCount}</td><td>{millis(bucket.avgDurationMs)}</td></tr>)}</tbody>
    </table></div>}
  </details>;
}

export function BackendOperations(p:Props) {
  const [search,setSearch]=useState('');
  const [kind,setKind]=useState('');
  const [errors,setErrors]=useState(false);
  const [order,setOrder]=useState('count');
  const [selection,setSelection]=useState(p.operationKey);
  const load=useCallback((signal:AbortSignal)=>getOperations(p.runId,signal),[p.runId]);
  const result=useBackendRead(JSON.stringify([p.scope,p.revision]),load);
  const selected=result.data?.find(op=>op.operationKey===selection);
  const visible=result.data?.filter(op=>matchesOperation(op,search,kind,p.field,errors)).sort((a,b)=>
    order==='duration'?(b.avgDurationMs??-1)-(a.avgDurationMs??-1):
    order==='errors'?(b.httpErrorCount+b.graphqlErrorCount)-(a.httpErrorCount+a.graphqlErrorCount):
    b.requestCount-a.requestCount)??[];
  return <>
    <div className="content-panel">
      <div className="panel-tools">
        <input aria-label="Поиск операции" placeholder="Поиск операции" value={search} onChange={e=>setSearch(e.target.value)}/>
        <KindSelect value={kind} onChange={setKind}/>
        <label><input type="checkbox" checked={errors} onChange={e=>setErrors(e.target.checked)}/> С ошибками</label>
        <select aria-label="Сортировка операций" value={order} onChange={e=>setOrder(e.target.value)}><option value="count">По частоте</option><option value="duration">По времени</option><option value="errors">По ошибкам</option></select>
        <button onClick={()=>{setSearch('');setKind('');setErrors(false);setOrder('count');p.onClearContext()}}>Сбросить</button>
      </div>
      {p.field&&<div className="active-filter">Поле: {p.field} <button onClick={p.onClearContext} aria-label="Убрать фильтр поля">×</button></div>}
      {visible.length?<div className="table-scroll"><table aria-label="Операции прогона">
        <thead><tr><th>Операция</th><th>Тип</th><th>Выполнений</th><th>HTTP</th><th>GraphQL</th><th>Среднее</th><th>Поля</th></tr></thead>
        <tbody>{visible.map(op=><tr key={op.operationKey} className={selection===op.operationKey?'selected':undefined} onClick={()=>setSelection(op.operationKey)}>
          <td><button className="run-history-select" onClick={()=>setSelection(op.operationKey)}>{operationLabel(op.operationName)}</button></td><td>{op.operationType}</td><td>{op.requestCount}</td><td>{op.httpErrorCount}</td><td>{op.graphqlErrorCount}</td><td>{millis(op.avgDurationMs)}</td><td>{op.fields.length}</td>
        </tr>)}</tbody>
      </table></div>:<Result {...result} empty="Операции не найдены."/>}
    </div>
    {selected&&<aside className="detail-panel">
      <DetailHead onClose={()=>setSelection('')}/>
      <h2>{operationLabel(selected.operationName)}</h2>
      <dl><dt>Тип</dt><dd>{selected.operationType}</dd><dt>Выполнений</dt><dd>{selected.requestCount}</dd><dt>Учтено в покрытии</dt><dd>{selected.countedRequestCount}</dd><dt>Ошибки HTTP / GraphQL</dt><dd>{selected.httpErrorCount} / {selected.graphqlErrorCount}</dd><dt>Среднее время</dt><dd>{millis(selected.avgDurationMs)}</dd><dt>Последнее обращение</dt><dd>{date(selected.lastSeenAt)}</dd></dl>
      <h3>Затронутые поля</h3>
      {selected.fields.map(f=><button className="detail-list-row" key={`${f.typeName}.${f.fieldName}`} onClick={()=>p.onField(f.typeName,f.fieldName)}>{f.typeName}.{f.fieldName} · {f.hits} Hits →</button>)}
      {mayReadJournal(p.role)?<button className="run-control" onClick={()=>p.onRequests(selected.operationKey)}>Показать обращения</button>:<p>Журнал доступен пользователям с соответствующими правами.</p>}
      <p>Безопасный GraphQL-код доступен в подробностях конкретного обращения.</p>
    </aside>}
  </>;
}

function KindSelect({value,onChange}:{value:string;onChange:(value:string)=>void}) {
  return <select aria-label="Тип операции" value={value} onChange={e=>onChange(e.target.value)}><option value="">Все типы</option><option value="query">Query</option><option value="mutation">Mutation</option><option value="subscription">Subscription</option></select>;
}
function DetailHead({onClose}:{onClose:()=>void}) {return <div className="detail-head"><strong>Подробности</strong><button aria-label="Закрыть подробности" onClick={onClose}>×</button></div>}

export function BackendRequests(p:Props) {
  const [search,setSearch]=useState('');
  const [name,setName]=useState<string>();
  const [kind,setKind]=useState('');
  const [filter,setFilter]=useState(p.filter);
  const [order,setOrder]=useState(p.sort==='duration'?'durationMs':'createdAt');
  const [field,setField]=useState(p.field);
  const [direction,setDirection]=useState<"asc"|"desc">("desc");
  const [httpCode,setHttpCode]=useState('');
  const [from,setFrom]=useState("");
  const [to,setTo]=useState("");
  const [offset,setOffset]=useState(0);
  const [selection,setSelection]=useState('');
  const allowed=mayReadJournal(p.role);
  const [typeName,fieldName]=field.split('.');
  const query=useMemo<JournalQuery>(()=>({operationName:name, operationKey:p.operationKey||undefined, operationType:kind||undefined,
    typeName:typeName||undefined,fieldName:fieldName||undefined,sortOrder:direction,
    from:from?new Date(from).toISOString():undefined,to:to?new Date(to).toISOString():undefined,sortBy:order==='durationMs'?'durationMs':'createdAt',
    httpStatus:httpCode?Number(httpCode):undefined,graphqlHasErrors:filter==='graphql'?true:undefined,httpStatusClass:filter==='http4'?4:filter==='http5'?5:undefined,
    analysisStatus:filter in analysisLabels?filter:undefined}),[name,p.operationKey,kind,typeName,fieldName,order,filter,direction,from,to,httpCode]);
  const group=filter==='http'||filter==='analyzer'?filter:'';
  const load=useCallback((signal:AbortSignal)=>getFilteredJournal(p.runId,query,offset,group,signal),[p.runId,query,offset,group]);
  const validInterval=!from||!to||from<to;
  const validHttpCode=!httpCode||/^[1-5]\d{2}$/.test(httpCode);
  const result=useBackendRead(allowed&&validInterval&&validHttpCode?JSON.stringify([p.scope,p.revision,query,offset,group]):null,load);
  const loadDetail=useCallback((signal:AbortSignal)=>getRequestDetail(p.runId,selection,signal),[p.runId,selection]);
  const details=useBackendRead(allowed&&selection?JSON.stringify([p.scope,p.revision,selection]):null,loadDetail);
  const change=(action:()=>void)=>{action();setOffset(0);setSelection('')};
  const request=details.data;
  return <>
    <div className="content-panel">
      {p.stats&&<Stats stats={p.stats}/>}
      {!allowed?<div className="empty-state">{p.role?'Для журнала нужна роль аналитика, оператора или администратора и доступ к сервису.':'Войдите в систему, чтобы открыть журнал обращений.'}</div>:<>
        <form className="panel-tools" onSubmit={e=>{e.preventDefault();change(()=>setName(search||undefined))}}>
          <input aria-label="Точное имя операции" placeholder="Точное имя операции" value={search} onChange={e=>setSearch(e.target.value)}/>
          <button type="submit">Найти</button>
          <KindSelect value={kind} onChange={value=>change(()=>setKind(value))}/>
          <select aria-label="Статусы обращений" value={filter} onChange={e=>change(()=>setFilter(e.target.value))}>
            <option value="all">Все статусы</option><option value="http">HTTP 4xx/5xx</option><option value="http4">HTTP 4xx</option><option value="http5">HTTP 5xx</option>
            <option value="graphql">GraphQL-ошибки</option><option value="analyzer">Ошибки анализа</option>
            {Object.entries(analysisLabels).map(([id,label])=><option value={id} key={id}>{label}</option>)}
          </select>
          <input aria-label="Точный HTTP-код" placeholder="HTTP-код" value={httpCode} maxLength={3} inputMode="numeric"
            className="run-http-code" onChange={e=>change(()=>setHttpCode(e.target.value))}/>
          <select aria-label="Поле схемы" value={field} onChange={e=>change(()=>setField(e.target.value))}><option value="">Все поля</option>
            {p.types.flatMap(t=>t.fields.map(f=><option key={`${t.name}.${f.name}`}>{t.name}.{f.name}</option>))}
          </select>
          <select aria-label="Сортировка обращений" value={order} onChange={e=>change(()=>setOrder(e.target.value))}><option value="createdAt">Сначала новые</option><option value="durationMs">Сначала долгие</option></select>
          <select aria-label="Направление сортировки" value={direction} onChange={e=>change(()=>setDirection(e.target.value==='asc'?'asc':'desc'))}><option value="desc">По убыванию</option><option value="asc">По возрастанию</option></select>
          <label>С <input type="datetime-local" aria-label="Начало интервала" max={to||undefined} value={from} onChange={e=>change(()=>setFrom(e.target.value))}/></label>
          <label>По <input type="datetime-local" aria-label="Конец интервала" min={from||undefined} value={to} onChange={e=>change(()=>setTo(e.target.value))}/></label>
          <button type="button" onClick={()=>change(()=>{setSearch('');setName(undefined);setKind('');setFilter('all');setOrder('createdAt');setField('');setDirection('desc');setFrom('');setTo('');setHttpCode('');p.onClearContext()})}>Сбросить</button>
        </form>
        {p.operationKey&&<div className="active-filter">Выбрана структура операции <button onClick={p.onClearContext} aria-label="Убрать фильтр операции">×</button></div>}
        {result.data?.rows.length?<div className="table-scroll"><table aria-label="Обращения прогона">
          <thead><tr><th>Дата и время</th><th>Операция</th><th>Тип</th><th>HTTP</th><th>GraphQL</th><th>Длительность</th><th>Анализ</th></tr></thead>
          <tbody>{result.data.rows.map(row=><tr key={row.id} className={selection===row.id?'selected':undefined} onClick={()=>setSelection(row.id)}>
            <td>{date(row.createdAt)}</td><td><button className="run-history-select" onClick={()=>setSelection(row.id)}>{operationLabel(row.operationName)}</button></td><td>{row.operationType??'—'}</td><td>{row.httpStatus??'—'}</td><td>{yesNo(row.graphqlHasErrors)}</td><td>{millis(row.durationMs)}</td><td>{analysisLabels[row.analysisStatus]??row.analysisStatus}</td>
          </tr>)}</tbody>
        </table></div>:<Result {...result} empty={!validInterval?'Начало интервала должно быть раньше окончания.':!validHttpCode?'Введите HTTP-код от 100 до 599.':'Обращения не найдены.'}/>}
        {(offset>0||result.data?.more)&&<div className="panel-tools"><button disabled={offset===0||result.loading} onClick={()=>{setOffset(offset-journalPageSize);setSelection('')}}>Назад</button>
          <span>Страница {offset/journalPageSize+1}</span><button disabled={!result.data?.more} onClick={()=>{setOffset(offset+journalPageSize);setSelection('')}}>Далее</button></div>}
      </>}
    </div>
    {allowed&&selection&&<aside className="detail-panel"><DetailHead onClose={()=>setSelection('')}/>
      {request?<><h2>{operationLabel(request.operationName)}</h2><dl>
        <dt>Дата</dt><dd>{date(request.createdAt)}</dd><dt>HTTP</dt><dd>{request.httpMethod} {request.httpStatus??'—'}</dd><dt>GraphQL ошибки</dt><dd>{yesNo(request.graphqlHasErrors)}</dd>
        <dt>Длительность</dt><dd>{millis(request.durationMs)}</dd><dt>Анализ</dt><dd>{analysisLabels[request.analysisStatus]??request.analysisStatus}</dd>
        <dt>В ответе есть данные</dt><dd>{yesNo(request.responseHasData)}</dd>
        <dt>Учтено в покрытии</dt><dd>{yesNo(request.countedInCoverage)}</dd>{request.errorCode&&<><dt>Код ошибки</dt><dd>{request.errorCode}</dd></>}
      </dl>
      {request.operationKey&&<button className="run-control" onClick={()=>p.onOperation(request.operationKey!)}>Открыть операцию</button>}
      <h3>Поля</h3>{request.selectedFields.length?request.selectedFields.map(f=><button className="detail-list-row" key={`${f.typeName}.${f.fieldName}`} onClick={()=>p.onField(f.typeName,f.fieldName)}>{f.typeName}.{f.fieldName}{f.returnType?` · ${f.returnType}`:''} →</button>):<p>Нет данных о полях.</p>}
      <h3>GraphQL-код</h3>{request.documentAvailability==='redacted'&&<p>Чувствительные значения скрыты сервером.</p>}{request.documentAvailability!=='unavailable'&&request.safeGraphqlDocument?<CodeView code={request.safeGraphqlDocument}/>:<p>Безопасный документ недоступен.</p>}
      </>:<Result {...details} empty="Нет данных обращения."/>}
    </aside>}
  </>;
}
