import {useEffect,useRef,useState,type KeyboardEvent} from 'react';
import {createPortal} from 'react-dom';
import type {SnapshotOption} from './backendSchema';
import {type Run,type RunMetrics} from './model';
import type {CatalogService, useServiceCatalog} from './serviceCatalog';
import {AccountControl} from './AccountControl';
import {CreateServiceDialog} from './CreateServiceDialog';
import {ActionNoticeDialog} from './ActionNoticeDialog';
import {workspaceActionCopy, type WorkspaceAction, type WorkspaceIntent} from './workspaceActions';
import type {ServiceCreate} from '../api/services';
import type {useAuth} from './useAuth';
import './top.css';
import './topEnhancements.css';

type Page='schema'|'operations'|'requests'|'history';
type Item={id:string;label:string;note?:string};
type MenuProps={label:string;value:string;items:Item[];empty:string;action?:string;onSelect:(id:string)=>void;onAction?:()=>void;status?:string;retry?:()=>void;disabled?:boolean;directActionWhenEmpty?:boolean};
function ContextMenu({label,value,items,empty,action,onSelect,onAction,status,retry,disabled,directActionWhenEmpty}:MenuProps){
 const [open,setOpen]=useState(false),[index,setIndex]=useState(0),[rect,setRect]=useState({top:0,left:0,width:0});
 const trigger=useRef<HTMLButtonElement>(null),menu=useRef<HTMLDivElement>(null),active=items.find(x=>x.id===value),count=items.length+Number(Boolean(action&&onAction))+Number(Boolean(retry));
 const close=(restore=false)=>{setOpen(false);if(restore)requestAnimationFrame(()=>trigger.current?.focus())};
 const show=()=>{if(disabled||!count)return;const r=trigger.current?.getBoundingClientRect();if(r)setRect({top:r.bottom+8,left:Math.min(r.left,window.innerWidth-Math.max(r.width,290)-12),width:Math.max(r.width,290)});setIndex(Math.max(0,items.findIndex(x=>x.id===value)));setOpen(true)};
 useEffect(()=>{if(!open)return;const outside=(e:PointerEvent)=>{if(!menu.current?.contains(e.target as Node)&&!trigger.current?.contains(e.target as Node))close()};const move=(event:Event)=>{if(!(event.target instanceof Node&&menu.current?.contains(event.target)))close()};document.addEventListener('pointerdown',outside);window.addEventListener('resize',move);window.addEventListener('scroll',move,true);return()=>{document.removeEventListener('pointerdown',outside);window.removeEventListener('resize',move);window.removeEventListener('scroll',move,true)}},[open]);
 useEffect(()=>{if(open)menu.current?.querySelectorAll<HTMLButtonElement>('[role="option"]')[index]?.focus()},[open,index]);
 const key=(e:KeyboardEvent)=>{if(e.key==='Tab'){close();trigger.current?.focus()}else if(e.key==='Escape'){e.preventDefault();close(true)}else if(e.key==='ArrowDown'){e.preventDefault();setIndex(i=>(i+1)%count)}else if(e.key==='ArrowUp'){e.preventDefault();setIndex(i=>(i+count-1)%count)}else if(e.key==='Home'){e.preventDefault();setIndex(0)}else if(e.key==='End'){e.preventDefault();setIndex(count-1)}};
 return <div className="context-selector"><button ref={trigger} className="context-trigger" type="button" aria-haspopup="listbox" aria-expanded={open} aria-label={`${label}: ${active?.label??empty}`} onClick={()=>items.length===0&&directActionWhenEmpty?onAction?.():open?close():show()} onKeyDown={e=>{if(!open&&!(items.length===0&&directActionWhenEmpty)&&['ArrowDown','ArrowUp','Enter',' '].includes(e.key)){e.preventDefault();show()}}} disabled={disabled}><span className="context-trigger-copy"><span>{label}</span><strong>{active?.label??empty}</strong></span><span aria-hidden="true">⌄</span></button>{open&&createPortal(<div ref={menu} className="context-menu" role="listbox" aria-label={label} style={{position:'fixed',top:rect.top,left:Math.max(12,rect.left),width:rect.width}} onKeyDown={key}>{items.length?<div className="context-options">{items.map((item,i)=><button type="button" key={item.id} role="option" aria-selected={item.id===value} className={item.id===value?'selected':''} onFocus={()=>setIndex(i)} onClick={()=>{onSelect(item.id);close(true)}}><span><strong>{item.label}</strong>{item.note&&<small>{item.note}</small>}</span>{item.id===value&&<b aria-hidden="true">✓</b>}</button>)}</div>:<p className="context-empty">{empty}</p>}{status&&<p role="status" className="context-empty">{status}</p>}{(retry||action&&onAction)&&<div className="context-action">{action&&onAction&&<button type="button" role="option" aria-selected="false" onFocus={()=>setIndex(items.length)} onClick={()=>{close();trigger.current?.focus();onAction()}}>{action}</button>}{retry&&<button type="button" role="option" aria-selected="false" onFocus={()=>setIndex(count-1)} onClick={()=>{close(true);retry()}}>Повторить загрузку</button>}</div>}</div>,document.body)}</div>;
}

type Props={intent:WorkspaceIntent|null;onAction:(action:WorkspaceAction)=>void;onCloseAction:()=>void;auth:ReturnType<typeof useAuth>;catalog:ReturnType<typeof useServiceCatalog>;mockSelected:boolean;serviceId:string;snapshots:(SnapshotOption & {types?:unknown[]})[];snapshot:SnapshotOption|null;snapshotStatus?:string;run:Run|null;metrics:RunMetrics;coverage:{totalFields:number;coveredFields:number;coveragePercent:number}|null;schemaFieldCount:number|null;page:Page;onService:(id:string)=>void;onCreateService:(input:ServiceCreate)=>Promise<void>;onSnapshot:(id:string)=>void;onImport:(file:File)=>Promise<{ok:boolean;message:string}>;onPage:(page:Page)=>void;onMetric:(key:string)=>void};
const tabs:{id:Page;label:string}[]=[{id:'schema',label:'Схема и покрытие'},{id:'operations',label:'Операции'},{id:'requests',label:'Обращения'}];
const date=(value:string|null)=>value?new Date(value).toLocaleString('ru-RU',{dateStyle:'short',timeStyle:'short'}):'—';
const endpointNote=(url:string|null)=>{if(!url)return 'URL не указан';try{const parsed=new URL(url);return `${parsed.host}${parsed.pathname}`.slice(0,48)}catch{return 'URL не указан'}};
function MetricButton({title,value,onClick,primary=false,hint}:{title:string;value:string|number;onClick?:()=>void;primary?:boolean;hint?:string}){return <button className={`top-metric ${primary?'primary-metric':''}`} onClick={onClick} disabled={!onClick} aria-label={`${title}: ${value}`} aria-description={hint} title={hint}><span>{title}{hint&&<span className="metric-info" title={hint} aria-hidden="true">ⓘ</span>}</span><strong>{value}</strong></button>}

function SnapshotDialog({local, service, onClose, onImport}: {
 local:boolean; service:CatalogService|null; onClose:()=>void; onImport:Props['onImport'];
}){
 const dialog=useRef<HTMLDialogElement>(null);
 const [method,setMethod]=useState<'sdl'|'introspection'>('sdl');
 const [state,setState]=useState<'idle'|'loading'|'error'>('idle');
 const [message,setMessage]=useState('');
 useEffect(()=>{if(!dialog.current?.open)dialog.current?.showModal()},[]);

 function close(){
  dialog.current?.close();
  onClose();
 }

 async function readLocalSdl(file:File){
  setState('loading');
  try{
   const result=await onImport(file);
   if(result.ok){close();return}
   setMessage(result.message);
  }catch{
   setMessage('Не удалось прочитать SDL.');
  }
  setState('error');
 }

 const description=method==='sdl'
  ?'Импорт SDL для сервисов API пока не подключён. Снимок из файла .graphql или .gql здесь пока сохранить нельзя.'
  :'Загрузка и сохранение схемы через introspection пока не подключены.';
 return (
  <dialog ref={dialog} className="create-service-dialog snapshot-dialog" aria-labelledby="snapshot-title"
   onCancel={event=>{event.preventDefault();close()}}
   onClick={event=>{if(event.target===event.currentTarget)close()}}>
   <div className="snapshot-dialog-content">
    <h2 id="snapshot-title">Добавить снимок схемы</h2>
    <p>Сервис: <strong>{service?.name}</strong></p>
    <div className="snapshot-methods" role="group" aria-label="Способ получения схемы">
     <button type="button" aria-pressed={method==='sdl'} className={method==='sdl'?'active':''} onClick={()=>setMethod('sdl')}>Импорт SDL</button>
     <button type="button" aria-pressed={method==='introspection'} className={method==='introspection'?'active':''} onClick={()=>setMethod('introspection')}>Introspection</button>
    </div>
    <div className="snapshot-method-body">
     {method==='introspection'&&<p>Endpoint: <code>{service?.endpointUrl||'URL не указан'}</code></p>}
     {local&&method==='sdl'?<>
      <p>Выберите файл .graphql или .gql. Схема будет проверена локальным GraphQL-парсером.</p>
      <label className="snapshot-file">Выбрать SDL<input type="file" accept=".graphql,.gql" disabled={state==='loading'} onChange={event=>{
       const file=event.currentTarget.files?.[0];
       if(file)void readLocalSdl(file);
       event.currentTarget.value='';
      }}/></label>
      {state==='loading'&&<p role="status">Проверяем SDL…</p>}
      {state==='error'&&<p role="alert" className="form-error">{message}</p>}
     </>:<p className="introspection-notice">{local?'Introspection для mock-сервиса недоступен. Используйте импорт SDL.':description}</p>}
    </div>
    <div className="create-service-actions"><button type="button" onClick={close}>Закрыть</button></div>
   </div>
  </dialog>
 );
}

export function TopChrome(p:Props){
 const {run,snapshot,metrics,coverage,intent}=p;const service=p.catalog.services.find(item=>item.id===p.serviceId)??null;const duration=run?.endedAt?`${Math.round((Date.parse(run.endedAt)-Date.parse(run.startedAt))/60000)} мин`:run?'Идёт':'—';
 const {state}=p.catalog;
 const loginHint=intent?.outcome==='login'?workspaceActionCopy[intent.action].login:undefined;
 const snapshotOpen=intent?.outcome==='local-snapshot'||intent?.outcome==='remote-snapshot';
 const notice=intent?.outcome==='denied'
  ?'Для этого действия нужны права оператора или администратора.'
  :intent?.outcome==='run-unavailable'
   ?(snapshot?'Создание прогонов для сервисов API пока не подключено.':'Для прогона нужен снимок схемы. Создание прогонов для сервисов API пока не подключено.')
   :null;
 const catalogStatus=state.kind==='loading'?'Загружаем сервисы API…':state.kind==='error'?state.error.message:state.services.length===0?'Нет доступных сервисов API. Добавьте сервис, чтобы начать работу.':undefined;
 return <><header className="top-global"><div className="top-brand"><span className="brand-glyph">◇</span><strong>GraphQL Coverage Proxy</strong></div><div className="context-group"><ContextMenu label="Сервис" value={p.serviceId} items={p.catalog.services.map(item=>({id:item.id,label:item.name,note:item.source==='mock'?'Локальные данные':endpointNote(item.endpointUrl)}))} empty="Сервис не выбран" status={catalogStatus} action="+ Добавить сервис" onSelect={p.onService} onAction={()=>p.onAction('service')} retry={state.kind==='error'?p.catalog.retry:undefined}/><ContextMenu label="Снимок схемы" value={snapshot?.id??''} items={p.snapshots.map(item=>({id:item.id,label:item.name,note:`${item.source==='introspection'?'Introspection':item.source==='sdl'?'SDL':item.source}${item.types?` · ${item.types.length} типов`:''} · ${date(item.createdAt)}`}))} empty={!p.mockSelected?(p.snapshotStatus??'Схема не выбрана'):p.snapshots.length?'Схема не выбрана':'Добавить снимок'} action={service?"+ Добавить снимок схемы":undefined} directActionWhenEmpty={p.mockSelected} onSelect={p.onSnapshot} onAction={()=>p.onAction('snapshot')} disabled={!service}/><div className="header-run"><span>Текущий прогон</span><div><strong title={run?.name??'Прогон не выбран'}>{run?.name??'Прогон не выбран'}</strong>{run&&<em className={`run-status ${run.status}`}>{run.status==='active'?'Активен':'Завершён'}</em>}</div><small>{run?`${date(run.startedAt)} · ${duration}`:p.mockSelected?'Выберите прогон в истории':'Прогоны API пока недоступны'}</small></div><button className={`history-action ${p.page==='history'?'active':''}`} onClick={()=>p.onPage('history')}>История</button></div><AccountControl auth={p.auth} loginHint={loginHint} onPromptClose={p.onCloseAction}/></header><nav className="top-nav" aria-label="Разделы аналитики">{tabs.map(tab=><button key={tab.id} className={p.page===tab.id?'active':''} aria-current={p.page===tab.id?'page':undefined} onClick={()=>p.onPage(tab.id)}>{tab.label}</button>)}</nav><section className="top-summary" aria-label="Сводка прогона"><div className="summary-area summary-coverage"><h2>Покрытие схемы</h2><div className="coverage-main"><div className="coverage-overview"><MetricButton title="Общее покрытие" value={run&&coverage?`${coverage.coveragePercent.toFixed(2)}%`:'Нет данных'} onClick={run?()=>p.onMetric('coverage'):undefined} primary/><div className="coverage-track"><i style={{width:run&&coverage?`${coverage.coveragePercent}%`:'0%'}}/></div></div><div className="coverage-counts"><MetricButton title="Покрыто" value={run?coverage?.coveredFields??'—':'—'} onClick={run?()=>p.onMetric('covered'):undefined}/><div className="static-metric"><span>Всего полей</span><strong>{p.schemaFieldCount??'—'}</strong></div><MetricButton title="Не покрыто" value={run&&coverage?coverage.totalFields-coverage.coveredFields:'—'} onClick={run?()=>p.onMetric('uncovered'):undefined}/></div></div></div><div className="summary-area summary-requests"><h2>Результаты обращений</h2><div className="request-grid"><MetricButton title="Обращения" value={run?metrics.total:'Нет данных'} onClick={run?()=>p.onMetric('requests'):undefined} primary/><MetricButton title="HTTP-ошибки" value={run?metrics.httpErrors:'—'} onClick={run?()=>p.onMetric('http'):undefined}/><MetricButton title="GraphQL-ошибки" value={run?metrics.graphqlErrors:'—'} onClick={run?()=>p.onMetric('graphql'):undefined}/><MetricButton title="Ошибки анализа" value={run?metrics.analyzerErrors:'—'} onClick={run?()=>p.onMetric('analyzer'):undefined}/><MetricButton title="Среднее время" value={run?`${metrics.averageMs} мс`:'—'} onClick={run?()=>p.onMetric('average'):undefined}/><MetricButton title="Уникальные операции" value={run?metrics.uniqueOperations:'—'} onClick={run?()=>p.onMetric('operations'):undefined}/><MetricButton title="Время ответа · P95" value={run?`${metrics.p95Ms} мс`:'—'} hint="95% измеренных обращений выполнялись не дольше указанного времени" onClick={run?()=>p.onMetric('p95'):undefined}/></div></div></section>{intent?.outcome==='create-service'&&<CreateServiceDialog onCreate={p.onCreateService} onClose={p.onCloseAction}/>}
 {snapshotOpen&&<SnapshotDialog local={intent.outcome==='local-snapshot'} onClose={p.onCloseAction} service={service} onImport={p.onImport}/>}
 {intent&&notice&&<ActionNoticeDialog title={workspaceActionCopy[intent.action].title} message={notice} onClose={p.onCloseAction}/>}</>;
}
