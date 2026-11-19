import {useCallback, useEffect, useId, useMemo, useState} from 'react';
import {getFilteredJournal, getOperations, getRequestDetail, journalPageSize, type JournalQuery, type RunStats} from '../api/runAnalytics';
import type {GraphType} from '../model';
import {useBackendRead} from './useBackendRead';
import {analyticsError, matchesOperation, mayReadJournal, operationLabel} from './runAnalyticsModel';
import {Select} from '../components/Select';
import {OperationDetailPanel} from './OperationDetailPanel';
import {defaultOperationAdvanced,type OperationAdvancedFilters,type OperationErrorFilter} from './runAnalyticsModel';
import {RequestsTable,requestAnalysisLabels as analysisLabels} from './RequestsTable';
import {OperationsTable} from './OperationsTable';
import type {SchemaCoordinate} from '../api/runPaths';
import {useRequestPathSearch} from './useRequestPathSearch';
import {RequestPathContext} from './RequestPathContext';
import './requestPaths.css';
import {RequestDetailPanel} from './RequestDetailPanel';
import {useExportFilterState,usePublishExport} from './ExportWorkspace';
import {operationExportBlocked,operationExportFilters,requestExportFilters} from './exportFilters';

type Props = {
  testExecutionId?:string;onTest?:(id:string)=>void;onClearTest?:()=>void;
  snapshotId?:string;requestPath?:readonly SchemaCoordinate[];onClearPath?:()=>void;
  runId: string; scope: string; revision: number; role?: string;
  field: string; operationKey: string; filter: string; sort: string; types: GraphType[]; stats?: RunStats;
  onField: (type: string, field: string) => void;
  onRequests: (key: string) => void;
  onOperation: (key: string) => void;
  onClearContext: () => void;
};
function Result({loading,error,empty}:{loading:boolean;error?:Error;empty:string}) {
  return <div className="empty-state" role={error?'alert':'status'}>{loading?'Загрузка…':error?analyticsError(error):empty}</div>;
}

const errorOptions=[{value:'',label:'Все операции'},{value:'http',label:'С HTTP-ошибками'},{value:'graphql',label:'С GraphQL-ошибками'},{value:'none',label:'Без HTTP- и GraphQL-ошибок'}] as const;
export function BackendOperations(p:Props) {
 const reset=JSON.stringify([p.field,p.operationKey]);
 const [search,setSearch]=useExportFilterState('operations','search','',reset);
 const [kind,setKind]=useExportFilterState('operations','kind','',reset);
 const [errors,setErrors]=useExportFilterState<OperationErrorFilter[]>('operations','errorCategories',[],reset);
 const [order,setOrder]=useExportFilterState('operations','order','count',reset);
 const [advanced,setAdvanced]=useExportFilterState<OperationAdvancedFilters>('operations','advanced',{...defaultOperationAdvanced,field:p.field},reset);
 const [expanded,setExpanded]=useState(false),[selection,setSelection]=useState(p.operationKey);
 const advancedId=useId();
 const load=useCallback((signal:AbortSignal)=>getOperations(p.runId,signal),[p.runId]);
 const result=useBackendRead(JSON.stringify([p.scope,p.revision]),load);
 const blocked=operationExportBlocked(search,errors,advanced);
 const exportNotice='Точный экспорт операций с поиском по имени или operationKey, категориями ошибок или дополнительными условиями недоступен в текущем API. Сбросьте эти условия либо выключите «Учитывать текущие фильтры», чтобы выгрузить все операции.';
 usePublishExport('operations',operationExportFilters(search,kind,advanced.field,errors.length===2&&errors.includes('http')&&errors.includes('graphql'),order),blocked?[exportNotice]:[],blocked);
 const visible=useMemo(()=>result.data?.filter(op=>matchesOperation(op,search,kind,advanced.field,errors,advanced)).sort((a,b)=>
  order==='duration'?(b.avgDurationMs??-1)-(a.avgDurationMs??-1):
  order==='errors'?(b.httpErrorCount+b.graphqlErrorCount)-(a.httpErrorCount+a.graphqlErrorCount):
  b.requestCount-a.requestCount)??[],[result.data,search,kind,advanced,errors,order]);
 const selected=visible.find(op=>op.operationKey===selection);
 useEffect(()=>{if(result.data&&selection&&!selected)setSelection('')},[result.data,selection,selected]);
 const update=<Key extends keyof OperationAdvancedFilters,>(key:Key,value:OperationAdvancedFilters[Key])=>setAdvanced(old=>({...old,[key]:value}));
 const fieldOptions=[...new Set([advanced.field,...p.types.flatMap(type=>type.fields.map(field=>type.name+'.'+field.name)),...(result.data??[]).flatMap(op=>op.fields.map(field=>field.typeName+'.'+field.fieldName))])].filter(Boolean).sort();
 const chips=[
  advanced.frequency&&{key:'frequency' as const,label:'Обращений: '+({one:'1',few:'2–4',many:'5+'}[advanced.frequency]??advanced.frequency)},
  advanced.duration&&{key:'duration' as const,label:'Среднее время ≥ '+(advanced.duration==='custom'?advanced.minMs||'…':advanced.duration)+' мс'},
  advanced.field&&{key:'field' as const,label:advanced.field},
  advanced.coverage&&{key:'coverage' as const,label:'Учёт: '+({full:'полностью',partial:'частично',none:'не учтено'}[advanced.coverage]??advanced.coverage)},
  advanced.anonymous&&{key:'anonymous' as const,label:'Безымянные'},
 ].filter(item=>Boolean(item));
 const validThreshold=advanced.duration!=='custom'||advanced.minMs.trim()!==''&&Number.isFinite(Number(advanced.minMs))&&Number(advanced.minMs)>=0;
 return <>
  <div className="content-panel operations-panel">
   <div className="panel-tools operations-tools">
    <label className="operation-search"><span>Поиск операции</span><input type="search" placeholder="Имя или operationKey" aria-label="Поиск операции" value={search} onChange={e=>setSearch(e.target.value)}/></label>
    <Select label="Тип операции" value={kind} onChange={setKind} modified={Boolean(kind)} options={[{value:'',label:'Все'},{value:'query',label:'Query'},{value:'mutation',label:'Mutation'},{value:'subscription',label:'Subscription'}]}/>
    <Select label="Тип ошибок" value="" selectedValues={errors.length?errors:['']} summary={errors.length?errors.map(value=>value==='http'?'HTTP':value==='graphql'?'GraphQL':'Без ошибок').join(' · '):'Все операции'} modified={errors.length>0} options={errorOptions} onChange={value=>setErrors(old=>!value?[]:old.includes(value)?old.filter(item=>item!==value):[...old,value])}/>
    <Select label="Сортировка" value={order} onChange={setOrder} options={[{value:'count',label:'По частоте'},{value:'duration',label:'По времени'},{value:'errors',label:'По ошибкам'}]}/>
    <button type="button" aria-expanded={expanded} aria-controls={advancedId} onClick={()=>setExpanded(!expanded)}>Дополнительные фильтры</button>
    <button type="button" onClick={()=>{setSearch('');setKind('');setErrors([]);setOrder('count');setAdvanced(defaultOperationAdvanced);p.onClearContext()}}>Сбросить</button>
    <div id={advancedId} className="operations-advanced" hidden={!expanded}>
     <Select label="Частота обращений" value={advanced.frequency} onChange={value=>update('frequency',value)} options={[{value:'',label:'Все'},{value:'one',label:'1'},{value:'few',label:'2–4'},{value:'many',label:'5+'}]}/>
     <Select label="Среднее время ответа" value={advanced.duration} onChange={value=>update('duration',value)} options={[{value:'',label:'Все'},{value:'100',label:'От 100 мс'},{value:'500',label:'От 500 мс'},{value:'custom',label:'Пользовательский порог'}]}/>
     {advanced.duration==='custom'&&<label><span>Порог, мс</span><input type="number" min="0" step="any" aria-label="Порог среднего времени, мс" aria-invalid={!validThreshold} value={advanced.minMs} onChange={e=>update('minMs',e.target.value)}/></label>}
     <label><span>Затронутое поле схемы</span><input list={advancedId+'-fields'} placeholder="Type.field" aria-label="Затронутое поле схемы" value={advanced.field} onChange={e=>update('field',e.target.value)}/><datalist id={advancedId+'-fields'}>{fieldOptions.map(value=><option key={value} value={value}/>)}</datalist></label>
     <Select label="Учёт в покрытии" value={advanced.coverage} onChange={value=>update('coverage',value)} options={[{value:'',label:'Все'},{value:'full',label:'Полностью'},{value:'partial',label:'Частично'},{value:'none',label:'Не учтено'}]}/>
     <label className="operation-anonymous"><input type="checkbox" checked={advanced.anonymous} onChange={e=>update('anonymous',e.target.checked)}/> Только безымянные операции</label>
    </div>
    <div className="operation-filter-status">
     {chips.map(chip=>chip&&<button type="button" key={chip.key} aria-label={'Убрать условие: '+chip.label} onClick={()=>update(chip.key,chip.key==='anonymous'?false:'')}>{chip.label} ×</button>)}
     <output aria-label="Найдено операций">{result.loading?'Загрузка…':result.data?visible.length+' из '+result.data.length+' операций':'—'}</output>
    </div>
    {!validThreshold&&<p className="operation-filter-error" role="alert">Введите неотрицательный порог времени в миллисекундах.</p>}
   </div>
   {result.error&&result.data&&<div className="operation-read-error" role="alert">{analyticsError(result.error)} Показаны последние доступные данные.</div>}
   {visible.length?<OperationsTable selectedId={selection} onSelect={setSelection} rows={visible.map(op=>({
    id:op.operationKey,name:operationLabel(op.operationName),anonymous:!op.operationName,kind:op.operationType,
    count:op.requestCount,httpErrors:op.httpErrorCount,graphqlErrors:op.graphqlErrorCount,
    averageMs:op.avgDurationMs,fieldCount:op.fields.length,
   }))}/>:<Result {...result} empty="Операции не найдены."/>}
  </div>
  {selected&&<OperationDetailPanel key={selected.operationKey} operation={selected} canReadRequests={mayReadJournal(p.role)} onClose={()=>setSelection('')} onField={p.onField} onRequests={p.onRequests}/>}
 </>;
}

export function BackendRequests(p:Props) {
  const reset=JSON.stringify([p.field,p.operationKey,p.testExecutionId,p.filter,p.sort]);
  const [search,setSearch]=useExportFilterState('requests','search','',reset);
  const [name,setName]=useExportFilterState<string|undefined>('requests','name',undefined,reset);
  const [kind,setKind]=useExportFilterState('requests','kind','',reset);
  const [filter,setFilter]=useExportFilterState('requests','filter',p.filter,reset);
  const [order,setOrder]=useExportFilterState('requests','order',p.sort==='duration'?'durationMs':'createdAt',reset);
  const [field,setField]=useExportFilterState('requests','field',p.field,reset);
  const [direction,setDirection]=useExportFilterState<'asc'|'desc'>('requests','direction','desc',reset);
  const [httpCode,setHttpCode]=useExportFilterState('requests','httpCode','',reset);
  const [from,setFrom]=useExportFilterState('requests','from',"",reset);
  const [to,setTo]=useExportFilterState('requests','to',"",reset);
  const [offset,setOffset]=useState(0);
  const [filtersOpen,setFiltersOpen]=useState(false);
  const filterPanelId=useId();
  const [selection,setSelection]=useState(''),[detailAttempt,setDetailAttempt]=useState(0);
  const allowed=mayReadJournal(p.role);
  const pathActive=Boolean(p.requestPath?.length);
  const pathSearch=useRequestPathSearch({runId:p.runId,snapshotId:p.snapshotId,scope:p.scope,path:p.requestPath,enabled:allowed&&pathActive});
  const [typeName,fieldName]=field.split('.');
  const query=useMemo<JournalQuery>(()=>({testExecutionId:p.testExecutionId,operationName:name, operationKey:p.operationKey||undefined, operationType:kind||undefined,
    typeName:typeName||undefined,fieldName:fieldName||undefined,sortOrder:direction,
    from:from?new Date(from).toISOString():undefined,to:to?new Date(to).toISOString():undefined,sortBy:order==='durationMs'?'durationMs':'createdAt',
    httpStatus:httpCode?Number(httpCode):undefined,graphqlHasErrors:filter==='graphql'?true:undefined,httpStatusClass:filter==='http4'?4:filter==='http5'?5:undefined,
    analysisStatus:filter in analysisLabels?filter:undefined}),[name,p.testExecutionId,p.operationKey,kind,typeName,fieldName,order,filter,direction,from,to,httpCode]);
  const group=filter==='http'||filter==='analyzer'?filter:'';
  usePublishExport('requests',requestExportFilters(query,group),pathActive?['Локальный AST-фильтр пути не применяется к экспорту обращений. Остальные серверные фильтры сохраняются.']:[]);
  const load=useCallback((signal:AbortSignal)=>getFilteredJournal(p.runId,query,offset,group,signal),[p.runId,query,offset,group]);
  const validInterval=!from||!to||from<to;
  const validHttpCode=!httpCode||/^[1-5]\d{2}$/.test(httpCode);
  const result=useBackendRead(allowed&&!pathActive&&validInterval&&validHttpCode?JSON.stringify([p.scope,p.revision,query,offset,group]):null,load);
  const cachedDetail=pathActive?pathSearch.getDetail(selection):undefined;
  const loadDetail=useCallback((signal:AbortSignal)=>cachedDetail?Promise.resolve(cachedDetail):getRequestDetail(p.runId,selection,signal),[p.runId,selection,cachedDetail]);
  const details=useBackendRead(allowed&&selection?JSON.stringify([p.scope,p.runId,p.snapshotId,p.revision,selection,detailAttempt]):null,loadDetail);
  const change=(action:()=>void)=>{action();setOffset(0);setSelection('')};
  const request=details.data;
  const rows=pathActive?pathSearch.state?.rows:result.data?.rows;
  const tableState=pathActive?{loading:!pathSearch.state||pathSearch.state.running,error:pathSearch.state?.error}:result;
  const activeFilterCount=[kind,filter!=='all',httpCode,field,order!=='createdAt',direction!=='desc',from,to,p.operationKey,p.testExecutionId].filter(Boolean).length;
  const fieldOptions=[...new Set([field,...p.types.flatMap(type=>type.fields.map(item=>type.name+'.'+item.name))])].filter(Boolean);
  return <>
    <div className="content-panel request-journal-panel">
      {!allowed?<div className="empty-state">{p.role?'Для журнала нужна роль аналитика, оператора или администратора и доступ к сервису.':'Войдите в систему, чтобы открыть журнал обращений.'}</div>:<>
        {pathActive&&<RequestPathContext path={p.requestPath!} state={pathSearch.state} onContinue={pathSearch.next} onCancel={pathSearch.cancel} onClear={()=>change(()=>p.onClearPath?.())} onSelect={setSelection}/>}
        <fieldset className="path-journal-filters" disabled={pathActive}><form className="panel-tools request-journal-tools" onSubmit={e=>{e.preventDefault();change(()=>setName(search||undefined))}}>
         <div className="request-search-row">
          <input type="search" aria-label="Точное имя операции" placeholder="Точное имя операции" value={search} onChange={e=>setSearch(e.target.value)}/>
          <button type="submit">Найти</button>
          <button type="button" className="request-filter-toggle" aria-expanded={filtersOpen} aria-controls={filterPanelId} onClick={()=>setFiltersOpen(!filtersOpen)}>
           <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 5h14M3 10h14M3 15h14"/><path d="M7 3v4m6 1v4m-7 1v4"/></svg>
           Фильтры{activeFilterCount>0&&` · ${activeFilterCount}`}<span aria-hidden="true">{filtersOpen?'▴':'▾'}</span>
          </button>
          <button type="button" onClick={()=>change(()=>{setSearch('');setName(undefined);setKind('');setFilter('all');setOrder('createdAt');setField('');setDirection('desc');setFrom('');setTo('');setHttpCode('');p.onClearContext()})}>Сбросить</button>
         </div>
         <div id={filterPanelId} className="request-filters" hidden={!filtersOpen}>
          {filtersOpen&&!pathActive&&<>
           <div className="request-filter-group"><h3>Фильтрация</h3><div className="request-filter-grid">
            <Select label="Тип операции" value={kind} onChange={value=>change(()=>setKind(value))} modified={Boolean(kind)} options={[{value:'',label:'Все типы'},{value:'query',label:'Query'},{value:'mutation',label:'Mutation'},{value:'subscription',label:'Subscription'}]}/>
            <Select label="Статусы обращений" value={filter} onChange={value=>change(()=>setFilter(value))} modified={filter!=='all'} options={[{value:'all',label:'Все статусы'},{value:'http',label:'HTTP 4xx/5xx'},{value:'http4',label:'HTTP 4xx'},{value:'http5',label:'HTTP 5xx'},{value:'graphql',label:'GraphQL-ошибки'},{value:'analyzer',label:'Ошибки анализа'},...Object.entries(analysisLabels).map(([value,label])=>({value,label}))]}/>
            <label><span>Точный HTTP-код</span><input aria-label="Точный HTTP-код" placeholder="HTTP-код" value={httpCode} maxLength={3} inputMode="numeric" className="run-http-code" onChange={e=>change(()=>setHttpCode(e.target.value))}/></label>
            <Select label="Поле схемы" value={field} onChange={value=>change(()=>setField(value))} modified={Boolean(field)} options={[{value:'',label:'Все поля'},...fieldOptions.map(value=>({value,label:value}))]}/>
           </div></div>
           <div className="request-filter-secondary">
            <div className="request-filter-group"><h3>Сортировка</h3><div className="request-filter-grid">
             <Select label="Сортировка обращений" value={order} onChange={value=>change(()=>setOrder(value))} options={[{value:'createdAt',label:'Сначала новые'},{value:'durationMs',label:'По длительности'}]}/>
             <Select label="Направление сортировки" value={direction} onChange={value=>change(()=>setDirection(value))} options={[{value:'desc',label:'По убыванию'},{value:'asc',label:'По возрастанию'}]}/>
            </div></div>
            <div className="request-filter-group"><h3>Период</h3><div className="request-filter-grid">
             <label><span>С</span><input type="datetime-local" aria-label="Начало интервала" max={to||undefined} value={from} onChange={e=>change(()=>setFrom(e.target.value))}/></label>
             <label><span>По</span><input type="datetime-local" aria-label="Конец интервала" min={from||undefined} value={to} onChange={e=>change(()=>setTo(e.target.value))}/></label>
            </div></div>
           </div>
          </>}
         </div>
        </form></fieldset>
        {p.testExecutionId&&<div className="active-filter test-journal-context">Выполнение теста: <code>{p.testExecutionId}</code> {p.onTest&&<button type="button" onClick={()=>p.onTest?.(p.testExecutionId!)}>Вернуться к тесту</button>}<button type="button" onClick={()=>change(()=>p.onClearTest?.())}>Сбросить фильтр теста</button></div>}
        {p.operationKey&&<div className="active-filter">Выбрана структура операции <button onClick={p.onClearContext} aria-label="Убрать фильтр операции">×</button></div>}
        {rows?.length?<RequestsTable rows={rows} selection={selection} onSelect={setSelection}/>:<Result {...tableState} empty={pathActive?'В просмотренных документах пока нет подтверждённых совпадений.':!validInterval?'Начало интервала должно быть раньше окончания.':!validHttpCode?'Введите HTTP-код от 100 до 599.':'Обращения не найдены.'}/>}
        {!pathActive&&(offset>0||result.data?.more)&&<div className="panel-tools"><button disabled={offset===0||result.loading} onClick={()=>{setOffset(offset-journalPageSize);setSelection('')}}>Назад</button>
          <span>Страница {offset/journalPageSize+1}</span><button disabled={!result.data?.more} onClick={()=>{setOffset(offset+journalPageSize);setSelection('')}}>Далее</button></div>}
      </>}
    </div>
    {allowed&&selection&&<RequestDetailPanel key={JSON.stringify([p.scope,p.runId,p.snapshotId,selection])} request={request} loading={details.loading} error={details.error} snapshotId={p.snapshotId} scope={p.scope} revision={p.revision} onClose={()=>setSelection('')} onRetry={()=>setDetailAttempt(attempt=>attempt+1)} onOperation={p.onOperation} onField={p.onField} onTest={p.onTest}/>}
  </>;
}
