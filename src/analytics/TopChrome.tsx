import {useEffect,useRef,useState,type KeyboardEvent} from 'react';
import {createPortal} from 'react-dom';
import type {SnapshotOption} from './backendSchema';
import {type Run,type RunMetrics} from './model';
import type {useServiceCatalog} from './serviceCatalog';
import {AccountControl} from './AccountControl';
import {CreateServiceDialog} from './CreateServiceDialog';
import {SnapshotNameDialog} from './SnapshotNameDialog';
import {SnapshotDialog} from './SnapshotDialog';
import type {SnapshotImport} from './schemaImport';
import {ActionNoticeDialog} from './ActionNoticeDialog';
import {workspaceActionCopy, type WorkspaceAction, type WorkspaceIntent} from './workspaceActions';
import type {ServiceCreate,ServiceUpdate} from '../api/services';
import type {useAuth} from './useAuth';
import type {RunOut} from '../api/runs';
import type {RunStats} from '../api/runAnalytics';
import {analysisErrors, millis} from './runAnalyticsModel';
import {runStatus} from './backendRuns';
import {canCreateService,endpointStatus} from './serviceCreation';
import {CreateRunDialog} from './RunDialogs';
import './top.css';
import './topEnhancements.css';

type Page='schema'|'operations'|'requests'|'history';
type Item={id:string;label:string;note?:string};
type MenuProps={label:string;value:string;items:Item[];empty:string;action?:string;onEdit?:()=>void;editLabel?:string;onSelect:(id:string)=>void;onAction?:()=>void;status?:string;retry?:()=>void;disabled?:boolean;directActionWhenEmpty?:boolean};
function ContextMenu({label,value,items,empty,action,onEdit,editLabel,onSelect,onAction,status,retry,disabled,directActionWhenEmpty}:MenuProps){
 const [open,setOpen]=useState(false),[index,setIndex]=useState(0),[rect,setRect]=useState({top:0,left:0,width:0});
 const trigger=useRef<HTMLButtonElement>(null),menu=useRef<HTMLDivElement>(null),active=items.find(x=>x.id===value),count=items.length+Number(Boolean(action&&onAction))+Number(Boolean(onEdit))+Number(Boolean(retry));
 const close=(restore=false)=>{setOpen(false);if(restore)requestAnimationFrame(()=>trigger.current?.focus())};
 const show=()=>{if(disabled||!count)return;const r=trigger.current?.getBoundingClientRect();if(r)setRect({top:r.bottom+8,left:Math.min(r.left,window.innerWidth-Math.max(r.width,290)-12),width:Math.max(r.width,290)});setIndex(Math.max(0,items.findIndex(x=>x.id===value)));setOpen(true)};
 useEffect(()=>{if(!open)return;const outside=(e:PointerEvent)=>{if(!menu.current?.contains(e.target as Node)&&!trigger.current?.contains(e.target as Node))close()};const move=(event:Event)=>{if(!(event.target instanceof Node&&menu.current?.contains(event.target)))close()};document.addEventListener('pointerdown',outside);window.addEventListener('resize',move);window.addEventListener('scroll',move,true);return()=>{document.removeEventListener('pointerdown',outside);window.removeEventListener('resize',move);window.removeEventListener('scroll',move,true)}},[open]);
 useEffect(()=>{if(open)menu.current?.querySelectorAll<HTMLButtonElement>('[role="option"]')[index]?.focus()},[open,index]);
 const key=(e:KeyboardEvent)=>{if(e.key==='Tab'){close();trigger.current?.focus()}else if(e.key==='Escape'){e.preventDefault();close(true)}else if(e.key==='ArrowDown'){e.preventDefault();setIndex(i=>(i+1)%count)}else if(e.key==='ArrowUp'){e.preventDefault();setIndex(i=>(i+count-1)%count)}else if(e.key==='Home'){e.preventDefault();setIndex(0)}else if(e.key==='End'){e.preventDefault();setIndex(count-1)}};
 return <div className="context-selector"><button ref={trigger} className="context-trigger" type="button" aria-haspopup="listbox" aria-expanded={open} aria-label={`${label}: ${active?.label??empty}`} onClick={()=>items.length===0&&directActionWhenEmpty?onAction?.():open?close():show()} onKeyDown={e=>{if(!open&&!(items.length===0&&directActionWhenEmpty)&&['ArrowDown','ArrowUp','Enter',' '].includes(e.key)){e.preventDefault();show()}}} disabled={disabled}><span className="context-trigger-copy"><span>{label}</span><strong title={active?.label??empty}>{active?.label??empty}</strong></span><span aria-hidden="true">⌄</span></button>{open&&createPortal(<div ref={menu} className="context-menu" role="listbox" aria-label={label} style={{position:'fixed',top:rect.top,left:Math.max(12,rect.left),width:rect.width}} onKeyDown={key}>{items.length?<div className="context-options">{items.map((item,i)=><button type="button" key={item.id} role="option" aria-selected={item.id===value} className={item.id===value?'selected':''} onFocus={()=>setIndex(i)} onClick={()=>{onSelect(item.id);close(true)}}><span><strong>{item.label}</strong>{item.note&&<small>{item.note}</small>}</span>{item.id===value&&<b aria-hidden="true">✓</b>}</button>)}</div>:<p className="context-empty">{empty}</p>}{status&&<p role="status" className="context-empty">{status}</p>}{(retry||onEdit||action&&onAction)&&<div className="context-action">{action&&onAction&&<button type="button" role="option" aria-selected="false" onFocus={()=>setIndex(items.length)} onClick={()=>{close();trigger.current?.focus();onAction()}}>{action}</button>}{onEdit&&<button type="button" role="option" aria-selected="false" onFocus={()=>setIndex(items.length+Number(Boolean(action&&onAction)))} onClick={()=>{close();trigger.current?.focus();onEdit()}}>{editLabel}</button>}{retry&&<button type="button" role="option" aria-selected="false" onFocus={()=>setIndex(count-1)} onClick={()=>{close(true);retry()}}>Повторить загрузку</button>}</div>}</div>,document.body)}</div>;
}

type Props={intent:WorkspaceIntent|null;onAction:(action:WorkspaceAction)=>void;onCloseAction:()=>void;auth:ReturnType<typeof useAuth>;catalog:ReturnType<typeof useServiceCatalog>;mockSelected:boolean;serviceId:string;snapshots:(SnapshotOption & {types?:unknown[]})[];snapshot:SnapshotOption|null;snapshotStatus?:string;run:Run|null;apiRun:RunOut|null;onCreateRun:(name:string)=>Promise<RunOut|null>;onFinishRun:()=>void;metrics:RunMetrics;backendStats?:RunStats;statsLoading:boolean;statsError?:string;onRefresh:()=>void;coverage:{totalFields:number;coveredFields:number;coveragePercent:number}|null;schemaFieldCount:number|null;page:Page;onService:(id:string)=>void;onCreateService:(input:ServiceCreate)=>Promise<void>;onEditService:(id:string,input:ServiceUpdate)=>Promise<void>;onSnapshot:(id:string)=>void;onImport:(input:SnapshotImport)=>Promise<void>;onRenameSnapshot:(name:string|null)=>Promise<void>;snapshotDisplayName?:string|null;onPage:(page:Page)=>void;onMetric:(key:string)=>void};
const tabs:{id:Page;label:string}[]=[{id:'schema',label:'Схема и покрытие'},{id:'operations',label:'Операции'},{id:'requests',label:'Обращения'}];
const date=(value:string|null)=>value?new Date(value).toLocaleString('ru-RU',{dateStyle:'short',timeStyle:'short'}):'—';
const time=(value:string)=>new Date(value).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'});
function MetricButton({title,value,onClick,primary=false,hint}:{title:string;value:string|number;onClick?:()=>void;primary?:boolean;hint?:string}){return <button className={`top-metric ${primary?'primary-metric':''}`} onClick={onClick} disabled={!onClick} aria-label={`${title}: ${value}`} aria-description={hint} title={hint}><span>{title}{hint&&<span className="metric-info" title={hint} aria-hidden="true">ⓘ</span>}</span><strong>{value}</strong></button>}

export function TopChrome(p:Props){
 const {run,snapshot,metrics,coverage,intent}=p;const service=p.catalog.services.find(item=>item.id===p.serviceId)??null;const duration=run?.endedAt?`${Math.round((Date.parse(run.endedAt)-Date.parse(run.startedAt))/60000)} мин`:run?'Идёт':'—';
 const {state}=p.catalog;
 const role=p.auth.session?.user.role;
 const [editing,setEditing]=useState<{id:string;revision:number}|null>(null);
 const editable=state.kind==='ready'&&canCreateService(p.auth.session)?state.services.find(item=>item.id===p.serviceId):undefined;
 const edited=editable&&editing?.id===editable.id&&editing.revision===p.auth.revision?editable:undefined;
 const [renaming,setRenaming]=useState<{id:string;revision:number}|null>(null);
 const canRename=!p.mockSelected&&snapshot&&canCreateService(p.auth.session);
 const renameOpen=canRename&&renaming?.id===snapshot.id&&renaming.revision===p.auth.revision;
 const stats=p.backendStats;
 const requestMetrics=Boolean(run||stats);
 const currentRun=run??p.apiRun;
 const runActivity=currentRun?.status==='active'||currentRun?.status==='running';
 const runTime=currentRun?`${date(currentRun.startedAt)} · ${run?duration:p.apiRun?.finishedAt?`до ${date(p.apiRun.finishedAt)}`:runActivity?'Идёт':'—'}`:'Выберите в истории';
 const visibleRunTime=p.apiRun?.finishedAt?`До ${time(p.apiRun.finishedAt)}`:
  p.apiRun?`С ${time(p.apiRun.startedAt)}`:runTime;
 const loginHint=intent?.outcome==='login'?workspaceActionCopy[intent.action].login:undefined;
 const snapshotOpen=intent?.outcome==='local-snapshot'||intent?.outcome==='remote-snapshot';
 const notice=intent?.outcome==='denied'
  ?'Для этого действия нужны права оператора или администратора.'
  :intent?.outcome==='create-run'&&(!snapshot||!service)
   ?'Сначала выберите снимок схемы для этого сервиса.'
   :null;
 const catalogStatus=state.kind==='loading'?'Загружаем сервисы API…':state.kind==='error'?state.error.message:state.services.length===0?'Нет доступных сервисов API. Добавьте сервис, чтобы начать работу.':undefined;
 return <><header className="top-global run-topbar"><div className="top-brand"><span className="brand-glyph">◇</span><strong>GraphQL Coverage Proxy</strong></div><div className="context-group"><ContextMenu label="Сервис" value={p.serviceId} items={p.catalog.services.map(item=>({id:item.id,label:item.name,note:item.source==='mock'?'Локальные данные':endpointStatus(item.endpointUrl,role)}))} empty="Сервис не выбран" status={catalogStatus} action="+ Добавить сервис" editLabel="Настройки сервиса" onSelect={p.onService} onAction={()=>p.onAction('service')} onEdit={editable?()=>setEditing({id:editable.id,revision:p.auth.revision}):undefined} retry={state.kind==='error'?p.catalog.retry:undefined}/><ContextMenu label="Снимок схемы" value={snapshot?.id??''} items={p.snapshots.map(item=>({id:item.id,label:item.name,note:`${item.source==='introspection'?'Introspection':item.source==='sdl'?'SDL':item.source}${item.types?` · ${item.types.length} типов`:''} · ${date(item.createdAt)}`}))} empty={!p.mockSelected?(p.snapshotStatus??'Схема не выбрана'):p.snapshots.length?'Схема не выбрана':'Добавить снимок'} action={service?"+ Добавить снимок схемы":undefined} editLabel="Переименовать снимок" onEdit={canRename?()=>setRenaming({id:snapshot.id,revision:p.auth.revision}):undefined} directActionWhenEmpty={p.mockSelected} onSelect={p.onSnapshot} onAction={()=>p.onAction('snapshot')} disabled={!service}/><div className="header-run">
  <span>Текущий прогон</span>
  <div className="header-run-name">
   <strong title={currentRun?.name??'Прогон не выбран'}>{currentRun?.name??'Прогон не выбран'}</strong>
  </div>
  <div className="header-run-meta">
   {currentRun&&<span className="run-badge" data-status={currentRun.status}>{runStatus(currentRun.status)}</span>}
   <small title={runTime}>{visibleRunTime}</small>
  </div>
 </div>
 <div className="run-header-actions" role="group" aria-label="Управление прогонами">
  {!p.mockSelected&&service&&<button type="button" className="run-control run-control-primary" onClick={()=>p.onAction('run')}>
   <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <path d="M8 3.5v9m-4.5-4.5h9"/>
   </svg>
   Новый прогон
  </button>}
  {!p.mockSelected&&service&&runActivity&&canCreateService(p.auth.session)&&
   <button type="button" className="run-control run-control-finish" onClick={p.onFinishRun}>Завершить прогон</button>}
  <button type="button" className="run-control" aria-current={p.page==='history'?'page':undefined} onClick={()=>p.onPage('history')}>История</button>
 </div>
 </div><AccountControl auth={p.auth} loginHint={loginHint} onPromptClose={p.onCloseAction}/></header><nav className="top-nav" aria-label="Разделы аналитики">{tabs.map(tab=><button key={tab.id} className={p.page===tab.id?'active':''} aria-current={p.page===tab.id?'page':undefined} onClick={()=>p.onPage(tab.id)}>{tab.label}</button>)}</nav><section className="top-summary" aria-label="Сводка прогона"><div className="summary-area summary-coverage"><h2>Покрытие схемы</h2><div className="coverage-main"><div className="coverage-overview"><MetricButton title="Общее покрытие" value={coverage?`${coverage.coveragePercent.toFixed(2)}%`:'Нет данных'} onClick={coverage?()=>p.onMetric('coverage'):undefined} hint="Наблюдаемое использование полей GraphQL в запросах прогона." primary/><div className="coverage-track"><i style={{width:coverage?`${coverage.coveragePercent}%`:'0%'}}/></div></div><div className="coverage-counts"><MetricButton title="Покрыто" value={coverage?.coveredFields??'—'} onClick={coverage?()=>p.onMetric('covered'):undefined}/><div className="static-metric"><span>Всего полей</span><strong>{p.schemaFieldCount??'—'}</strong></div><MetricButton title="Не покрыто" value={coverage?coverage.totalFields-coverage.coveredFields:'—'} onClick={coverage?()=>p.onMetric('uncovered'):undefined}/></div></div></div><div className="summary-area summary-requests"><div className="request-summary-heading"><h2>Результаты обращений</h2>{p.apiRun&&<button type="button" className="run-control" onClick={p.onRefresh} disabled={p.statsLoading}>Обновить аналитику</button>}</div>{(p.statsError||p.statsLoading)&&<p role={p.statsError?'alert':'status'}>{p.statsError??'Обновляем статистику…'}</p>}<div className="request-grid"><MetricButton title="Обращения" value={stats?.totalRequests??(run?metrics.total:'Нет данных')} onClick={requestMetrics?()=>p.onMetric('requests'):undefined} primary/><MetricButton title="HTTP-ошибки" value={stats?.httpErrorCount??(run?metrics.httpErrors:'—')} onClick={requestMetrics?()=>p.onMetric('http'):undefined}/><MetricButton title="GraphQL-ошибки" value={stats?.graphqlErrorCount??(run?metrics.graphqlErrors:'—')} onClick={requestMetrics?()=>p.onMetric('graphql'):undefined}/><MetricButton title="Ошибки анализа" value={stats?(analysisErrors(stats)??'—'):run?metrics.analyzerErrors:'—'} onClick={requestMetrics?()=>p.onMetric('analyzer'):undefined}/><MetricButton title="Среднее время" value={stats?millis(stats.avgDurationMs):run?`${metrics.averageMs} мс`:'—'} onClick={requestMetrics?()=>p.onMetric('average'):undefined}/><MetricButton title="Уникальные операции" value={stats?.uniqueOperations??(run?metrics.uniqueOperations:'—')} onClick={requestMetrics?()=>p.onMetric('operations'):undefined}/><MetricButton title="Время ответа · P95" value={stats?millis(stats.p95DurationMs):run?`${metrics.p95Ms} мс`:'—'} hint="95% измеренных обращений выполнялись не дольше указанного времени" onClick={requestMetrics?()=>p.onMetric('p95'):undefined}/></div></div></section>{intent?.outcome==='create-service'&&<CreateServiceDialog onCreate={p.onCreateService} onClose={p.onCloseAction}/>}
 {edited&&<CreateServiceDialog key={edited.id} onCreate={p.onCreateService} edit={{service:edited,role,hasSelectedActiveRun:p.apiRun?.status==='running',onUpdate:input=>p.onEditService(edited.id,input)}} onClose={()=>setEditing(null)}/>}
 {renameOpen&&<SnapshotNameDialog key={snapshot.id} name={p.snapshotDisplayName??''} currentName={snapshot.name} onSave={p.onRenameSnapshot} onClose={()=>setRenaming(null)}/>}
 {snapshotOpen&&<SnapshotDialog local={intent.outcome==='local-snapshot'} onClose={p.onCloseAction} service={service} onImport={p.onImport}/>}
 {intent?.outcome==='create-run'&&service&&snapshot&&<CreateRunDialog key={snapshot.id} serviceName={service.name} endpointNote={endpointStatus(service.endpointUrl,role)} snapshotName={snapshot.name} onCreate={p.onCreateRun} onClose={p.onCloseAction}/>}
 {intent&&notice&&<ActionNoticeDialog title={workspaceActionCopy[intent.action].title} message={notice} onClose={p.onCloseAction}/>}</>;
}
