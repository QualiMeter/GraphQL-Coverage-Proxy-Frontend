import {useState} from 'react';
import {ContextChevron,ContextMenu} from './ContextMenu';
import {AnalyticsSummary} from './AnalyticsSummary';
import type {SnapshotOption} from './backendSchema';
import type {useServiceCatalog} from './serviceCatalog';
import {useInterfaceTheme} from './InterfaceSettings';
import {ThemeToggle} from './ThemeToggle';
import {BrandLogo} from './BrandLogo';
import {AccountControl} from './AccountControl';
import {CreateServiceDialog} from './CreateServiceDialog';
import {SnapshotNameDialog} from './SnapshotNameDialog';
import {SnapshotDialog} from './SnapshotDialog';
import type {SnapshotImport} from './schemaImport';
import {ActionNoticeDialog} from './ActionNoticeDialog';
import {workspaceActionCopy, type WorkspaceAction, type WorkspaceIntent} from './workspaceActions';
import type {ServiceCreate,ServiceUpdate} from '../api/services';
import type {useAuth} from './useAuth';
import type {GitlabPipeline} from '../api/gitlab';
import type {RunOut} from '../api/runs';
import type {RunStats} from '../api/runAnalytics';
import {runStatus} from './backendRuns';
import {canCreateService,endpointStatus} from './serviceCreation';
import {CreateRunDialog} from './RunDialogs';
import './top.css';
import './topEnhancements.css';

type Page='schema'|'operations'|'requests'|'history';
type Props={gitlabManaged:boolean;gitlabChecking:boolean;onGitlab:(ref:string,name?:string)=>Promise<GitlabPipeline|null>;showSummary?:boolean;intent:WorkspaceIntent|null;onAction:(action:WorkspaceAction)=>void;onCloseAction:()=>void;auth:ReturnType<typeof useAuth>;catalog:ReturnType<typeof useServiceCatalog>;serviceId:string;snapshots:(SnapshotOption & {types?:unknown[]})[];snapshot:SnapshotOption|null;snapshotStatus?:string;apiRun:RunOut|null;onCreateRun:(name:string)=>Promise<RunOut|null>;onFinishRun:()=>void;backendStats?:RunStats;statsLoading:boolean;summaryErrors:string[];onRefresh:()=>void;onRefreshSummary:()=>void;coverage:{totalFields:number;coveredFields:number;coveragePercent:number}|null;schemaFieldCount:number|null;page:Page;onService:(id:string)=>void;onCreateService:(input:ServiceCreate)=>Promise<void>;onEditService:(id:string,input:ServiceUpdate)=>Promise<void>;onSnapshot:(id:string)=>void;onImport:(input:SnapshotImport)=>Promise<void>;onRenameSnapshot:(name:string|null)=>Promise<void>;snapshotDisplayName?:string|null;onPage:(page:Page)=>void;onMetric:(key:string)=>void;onAdmin:()=>void;adminOpen:boolean;canFinish:boolean;coverageRefreshing:boolean;contextRefreshing:boolean};
const tabs:{id:Page;label:string}[]=[{id:'schema',label:'Схема и покрытие'},{id:'operations',label:'Операции'},{id:'requests',label:'Обращения'}];
const date=(value:string|null)=>value?new Date(value).toLocaleString('ru-RU',{dateStyle:'short',timeStyle:'short'}):'—';
export function TopChrome(p:Props){
 const {snapshot,coverage,intent}=p;const service=p.catalog.services.find(item=>item.id===p.serviceId)??null;
 const {state}=p.catalog;
 const theme=useInterfaceTheme();
 const role=p.auth.session?.user.role;
 const [editing,setEditing]=useState<{id:string;revision:number}|null>(null);
 const editable=state.kind==='ready'&&canCreateService(p.auth.session)?state.services.find(item=>item.id===p.serviceId):undefined;
 const edited=editable&&editing?.id===editable.id&&editing.revision===p.auth.revision?editable:undefined;
 const [renaming,setRenaming]=useState<{id:string;revision:number}|null>(null);
 const canRename=snapshot&&canCreateService(p.auth.session);
 const renameOpen=canRename&&renaming?.id===snapshot.id&&renaming.revision===p.auth.revision;
 const currentRun=p.apiRun;
 const runActivity=currentRun?.status==='running';
 const finishedAt=p.apiRun?.finishedAt;
 const loginHint=intent?.outcome==='login'?workspaceActionCopy[intent.action].login:undefined;
 const snapshotOpen=intent?.outcome==='remote-snapshot';
 const notice=intent?.outcome==='denied'
  ?'Для этого действия нужны права оператора или администратора.'
  :intent?.outcome==='create-run'&&(!snapshot||!service)
   ?'Сначала выберите снимок схемы для этого сервиса.'
   :null;
 const catalogStatus=state.kind==='loading'?'Загружаем сервисы API…':state.kind==='error'?state.error.message:state.services.length===0?'Нет доступных сервисов API. Добавьте сервис, чтобы начать работу.':undefined;
 return <><header className="top-global workspace-brandbar"><BrandLogo/><div className="header-preferences"><ThemeToggle dark={theme.effective==='dark'} onToggle={()=>theme.choose(theme.effective==='dark'?'light':'dark')}/>
 <AccountControl auth={p.auth} loginHint={loginHint} onPromptClose={p.onCloseAction} onAdmin={p.onAdmin}/></div></header>{!p.adminOpen&&<><section className="workspace-context" aria-label="Контекст работы"><div className="context-group"><ContextMenu label="Сервис" value={p.serviceId} items={p.catalog.services.map(item=>({id:item.id,label:item.name,note:endpointStatus(item.endpointUrl,role)}))} empty="Сервис не выбран" status={catalogStatus} action="+ Добавить сервис" editLabel="Настройки выбранного сервиса" onSelect={p.onService} onAction={()=>p.onAction('service')} onEdit={editable?()=>setEditing({id:editable.id,revision:p.auth.revision}):undefined} retry={state.kind==='error'?p.catalog.retry:undefined}/><ContextMenu label="Снимок схемы" value={snapshot?.id??''} items={p.snapshots.map(item=>({id:item.id,label:item.name,note:`${item.source==='introspection'?'Introspection':item.source==='sdl'?'SDL':item.source}${item.types?` · ${item.types.length} типов`:''} · ${date(item.createdAt)}`}))} empty={p.snapshotStatus??'Схема не выбрана'} action={service?"+ Добавить снимок схемы":undefined} editLabel="Переименовать снимок" onEdit={canRename?()=>setRenaming({id:snapshot.id,revision:p.auth.revision}):undefined} onSelect={p.onSnapshot} onAction={()=>p.onAction('snapshot')} disabled={!service}/><button className="context-trigger workspace-run" type="button" onClick={()=>p.onPage('history')}
   aria-current={p.page==='history'?'page':undefined} aria-label={currentRun?`Выбранный прогон: ${currentRun.name}. Открыть историю`:'Выбрать прогон'}
   disabled={!service}>
   <span className="context-trigger-copy">
    <span>Выбранный прогон</span>
    <strong title={currentRun?.name}>{currentRun?.name??'Выбрать прогон'}</strong>
    {currentRun&&<small title={`Начало ${date(currentRun.startedAt)}${finishedAt?` · Окончание ${date(finishedAt)}`:''}`}>Начало {date(currentRun.startedAt)}{finishedAt&&<> · Окончание {date(finishedAt)}</>}</small>}
   </span>
   {currentRun&&<span className="run-badge" data-status={currentRun.status}>{runStatus(currentRun.status)}</span>}
   <ContextChevron/>
 </button>
 <div className="run-header-actions" role="group" aria-label="Управление прогонами">
  {service&&snapshot&&(!role||role==='operator'||role==='admin')&&<button type="button" className="run-control run-control-primary" onClick={()=>p.onAction('run')}>
   <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <path d="M8 3.5v9m-4.5-4.5h9"/>
   </svg>
   Новый прогон
  </button>}
  {service&&runActivity&&!p.canFinish&&!p.gitlabManaged&&<small className="run-access-note" title="Для завершения прогона нужен доступ оператора к сервису или роль администратора.">{p.gitlabChecking?'Проверяем управление прогоном…':'Доступ на завершение не подтверждён'}</small>}
  {service&&runActivity&&p.canFinish&&
   <button type="button" className="run-control run-control-finish" onClick={p.onFinishRun}>Завершить прогон</button>}
  {service&&<button type="button" className="run-control" onClick={p.onRefresh} disabled={p.statsLoading||p.coverageRefreshing||p.contextRefreshing}>Обновить</button>}
 </div></div></section><nav className="top-nav" aria-label="Разделы аналитики">{tabs.map(tab=><button key={tab.id} id={`analytics-section-${tab.id}`} type="button" className={p.page===tab.id?'active':''} aria-current={p.page===tab.id?'page':undefined} onClick={()=>p.onPage(tab.id)}>{tab.label}</button>)}</nav>{p.showSummary!==false&&<AnalyticsSummary coverage={coverage} schemaFieldCount={p.schemaFieldCount} stats={p.backendStats}
  selected={Boolean(currentRun)} refresh={p.apiRun?p.onRefreshSummary:undefined} loading={p.statsLoading||p.coverageRefreshing}
  errors={p.summaryErrors} onMetric={p.onMetric}/>}</>}{intent?.outcome==='create-service'&&<CreateServiceDialog onCreate={p.onCreateService} onClose={p.onCloseAction}/>}
 {edited&&<CreateServiceDialog key={edited.id} onCreate={p.onCreateService} edit={{service:edited,role,hasSelectedActiveRun:p.apiRun?.status==='running',onUpdate:input=>p.onEditService(edited.id,input)}} onClose={()=>setEditing(null)}/>}
 {renameOpen&&<SnapshotNameDialog key={snapshot.id} name={p.snapshotDisplayName??''} currentName={snapshot.name} onSave={p.onRenameSnapshot} onClose={()=>setRenaming(null)}/>}
 {snapshotOpen&&<SnapshotDialog onClose={p.onCloseAction} service={service} onImport={p.onImport}/>}
 {intent?.outcome==='create-run'&&service&&snapshot&&<CreateRunDialog key={`${service.id}:${snapshot.id}`} serviceId={service.id} onGitlab={p.onGitlab} onHistory={()=>p.onPage('history')} serviceName={service.name} endpointNote={endpointStatus(service.endpointUrl,role)} snapshotName={snapshot.name} onCreate={p.onCreateRun} onClose={p.onCloseAction}/>}
 {intent&&notice&&<ActionNoticeDialog title={workspaceActionCopy[intent.action].title} message={notice} onClose={p.onCloseAction}/>}</>;
}
