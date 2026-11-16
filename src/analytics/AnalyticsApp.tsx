import {useMemo,useState,useCallback,useEffect,useRef} from 'react';
import {ReactFlow,ReactFlowProvider,Background,MarkerType,useReactFlow,useNodesInitialized,type Edge,type NodeChange} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {fieldId, type GraphType} from '../model';
import {graphEdges,layout} from '../graph/transform';
import {TypeNode,type TypeFlowNode} from '../graph/TypeNode';
import {RoutedEdge} from '../graph/RoutedEdge';
import {CodeView} from './CodeView';
import {GraphControls} from './GraphControls';
import {OperationsTable} from './OperationsTable';
import {canManageUsers} from '../api/admin';
import {AdminUsers} from './AdminUsers';
import {TopChrome} from './TopChrome';
import {SchemaExplorer} from './SchemaExplorer';
import {SchemaDetailPanel} from './SchemaDetailPanel';
import {SchemaCoverageTable} from './SchemaCoverageTable';
import type {CoverageFilter} from './coverageTableFilters';
import {currentStep,emptyHistory,moveStep,pushStep,updateStep,type InvestigationHistory} from './schemaInvestigation';
import {loadStore,saveStore} from './storage';
import {coverageFor,metricsFor,operationsFor,requestsFor,type Run,type Store} from './model';
import {snapshotFromSDL} from './sdl';
import {isMockService, MOCK_SERVICE_ID} from './mockService';
import {useServiceCatalog} from './serviceCatalog';
import {useAuth} from './useAuth';
import {ApiError} from '../api/client';
import {createService, updateService, type ServiceCreate, type ServiceUpdate} from '../api/services';
import {canCreateService} from './serviceCreation';
import {workspaceActionFor, type WorkspaceAction, type WorkspaceIntent} from './workspaceActions';
import {schemaGraphTypes, snapshotOption} from './backendSchema';
import {useBackendSchema, useBackendSdl} from './useBackendSchema';
import {coverageErrorMessage} from './useRunCoverage';
import {runAnalyticsErrors, useRunAnalytics} from './useRunAnalytics';
import {importSchemaIntrospection, importSchemaSdl, renameSchema} from '../api/schemas';
import type {SnapshotImport} from './schemaImport';
import {createRun as postRun, finishRun as postFinishRun, findRun, type RunOut} from '../api/runs';
import {runActionError, selectedRun, runSelectionForHistory, type RunSelection} from './backendRuns';
import {BackendOperations, BackendRequests} from './BackendRunAnalytics';
import {analyticsError, mayReadJournal} from './runAnalyticsModel';
import {readWorkspace, saveWorkspace} from './workspaceSelection';
import {BackendRunHistory} from './BackendRunHistory';
import {FinishRunDialog} from './RunDialogs';
import {summaryDestination} from './navigation';
import './analytics.css';
import '../graph/graph.css';
import './redesign.css';
import './context.css';
import './workspace.css';
import './workspaceDark.css';
import './profileAdmin.css';
type Page='schema'|'operations'|'requests'|'history';
type RequestFilter='all'|'http'|'graphql'|'analyzer';
const fmt=(v:string|null)=>v?new Date(v).toLocaleString('ru-RU',{dateStyle:'short',timeStyle:'short'}):'—';
const emptyGraphTypes:GraphType[]=[];
const duration=(run:Run)=>run.endedAt?`${Math.round((Date.parse(run.endedAt)-Date.parse(run.startedAt))/60000)} мин`:'—';
function Inner(){const [saved]=useState(readWorkspace);const pendingRestore=useRef(saved?.runId??null);const [store,setStore]=useState<Store>(loadStore),[serviceId,setServiceId]=useState(saved?.serviceId??MOCK_SERVICE_ID),[runId,setRunId]=useState(saved?.runId??(saved?'':'reg13')),[snapshotId,setSnapshotId]=useState(saved?.snapshotId??'customer-v2'),[page,setPage]=useState<Page>('schema'),[mode,setMode]=useState<'graph'|'table'>('graph'),[fieldFilter,setFieldFilter]=useState<CoverageFilter>('all'),[query,setQuery]=useState(''),[requestFilter,setRequestFilter]=useState<RequestFilter>('all'),[requestField,setRequestField]=useState(''),[requestOperation,setRequestOperation]=useState(''),[operationKind,setOperationKind]=useState('all'),[operationField,setOperationField]=useState(''),[operationErrors,setOperationErrors]=useState(false),[sort,setSort]=useState('date'),[detail,setDetail]=useState<{kind:'type'|'field'|'operation'|'request';id:string}|null>(null),[detailTab,setDetailTab]=useState('Информация'),[schemaHistory,setSchemaHistory]=useState<InvestigationHistory>(emptyHistory),[explorerRequest,setExplorerRequest]=useState(0),[message,setMessage]=useState('');const flow=useReactFlow();
 useEffect(()=>saveStore(store),[store]);
 const auth=useAuth();
 const [adminRevision,setAdminRevision]=useState<number|null>(null);
 const adminOpen=canManageUsers(auth.session)&&adminRevision===auth.revision;
 const {restore,session}=auth;
 const [actionRequest,setActionRequest]=useState<(WorkspaceIntent&{revision:number;serviceId:string})|null>(null);
 const intent=actionRequest?.serviceId===serviceId&&actionRequest.revision===auth.revision?actionRequest:null;
 const catalog=useServiceCatalog(store.services,auth.checked?auth.revision:null);
 useEffect(()=>{
  if(session&&catalog.state.kind==='error'&&catalog.state.error.status===401)void restore();
 },[catalog.state,restore,session]);
 const mockSelected=isMockService(serviceId);
 const [serviceVersion,setServiceVersion]=useState(0);
 const [snapshotVersion,setSnapshotVersion]=useState(0);
 const serviceScope=`${auth.revision}:${serviceVersion}`;
 const graphScope=`${serviceScope}:${snapshotVersion}`;
 const remoteService=catalog.services.find(service=>service.source==='backend'&&service.id===serviceId);
 const hasPrivateServiceAccess=catalog.state.kind==='ready'&&catalog.state.services.some(service=>service.id===serviceId&&!service.isPublic);
 const canFinishRun=mockSelected||canCreateService(session)&&
  (session.user.role==='admin'||Boolean(remoteService?.endpointUrl)||hasPrivateServiceAccess);
 const remote=useBackendSchema(remoteService?.id??null,snapshotId,serviceScope,graphScope);
 const remoteList=remote.snapshots.state;
 const remoteGraph=remote.graph.state;
 const selectedRemote=remote.selected? snapshotOption(remote.selected):null;
 const localSnapshots=mockSelected?store.snapshots.filter(item=>item.serviceId===serviceId):[];
 const mockRuns=mockSelected?store.runs.filter(item=>item.serviceId===serviceId):[];
 const run=mockRuns.find(item=>item.id===runId)??null;
 const snapshot=localSnapshots.find(item=>item.id===(run?.snapshotId??snapshotId))??null;
 const selectedSnapshot=mockSelected?snapshot:selectedRemote;
 const schemaId=selectedSnapshot?.id??null;
 const [apiRunSelection,setApiRunSelection]=useState<RunSelection|null>(null);
 const apiRun=remoteService?selectedRun(apiRunSelection,serviceScope,schemaId):null;
 const [coverageVersion,setCoverageVersion]=useState(0);
 const {coverage:runCoverage,stats,scope:analysisScope,revision:analysisRevision,refresh:refreshRunAnalytics}=
  useRunAnalytics(apiRun,schemaId,`${graphScope}:${coverageVersion}`);
 const [restoreEnded,setRestoreEnded]=useState(false);
 const restoreTarget=!mockSelected&&schemaId===saved?.snapshotId&&serviceId===saved?.serviceId?saved?.runId:null;
 useEffect(()=>{
  if(!restoreTarget||!schemaId||pendingRestore.current!==restoreTarget)return;
  const controller=new AbortController();
  void findRun(schemaId,restoreTarget,controller.signal).then(restored=>{
   if(controller.signal.aborted||pendingRestore.current!==restoreTarget)return;
   pendingRestore.current=null;
   if(restored)setApiRunSelection({scope:serviceScope,run:restored});
   setRestoreEnded(true);
  },(error:Error)=>{
   if(controller.signal.aborted||pendingRestore.current!==restoreTarget)return;
   pendingRestore.current=null;
   setMessage(analyticsError(error));
   setRestoreEnded(true);
  });
  return ()=>controller.abort();
 },[restoreTarget,schemaId,serviceScope]);
 useEffect(()=>{
  if(!mockSelected&&(!schemaId||pendingRestore.current&&!restoreEnded&&schemaId===saved?.snapshotId))return;
  saveWorkspace({serviceId,snapshotId:schemaId,runId:mockSelected?run?.id??null:apiRun?.id??null});
 },[mockSelected,serviceId,schemaId,run?.id,apiRun?.id,restoreEnded,saved?.snapshotId]);
 const [backendNavigation,setBackendNavigation]=useState(0);
 const [backendOperationKey,setBackendOperationKey]=useState('');
 const refreshContext=async()=>{
  if(!apiRun){
   if(schemaId)remote.graph.retry();
   else remote.snapshots.retry();
   setHistoryVersion(value=>value+1);
   return;
  }
  if(!refreshRunAnalytics())return;
  setHistoryVersion(value=>value+1);
  try{
   const updated=await findRun(apiRun.snapshotId,apiRun.id);
   setApiRunSelection(previous=>previous?.scope===serviceScope&&previous.run===apiRun
    ? updated?{scope:serviceScope,run:updated}:null : previous);
  }catch(error){
   if(error instanceof ApiError&&error.status===401&&auth.getCurrent().revision===auth.revision)void restore();
  }
 };
 const [finishRequest,setFinishRequest]=useState<RunSelection|null>(null);
 const finishTarget=remoteService?selectedRun(finishRequest,serviceScope,schemaId):null;
 const [historyVersion,setHistoryVersion]=useState(0);
 const refreshHistory=()=>setHistoryVersion(version=>version+1);
 const snapshots=mockSelected?localSnapshots:remote.items.map(snapshotOption);
 const requests=useMemo(()=>run?requestsFor(store,run.id):[],[store,run]);
 const metrics=useMemo(()=>metricsFor(requests),[requests]);
 const coverage=useMemo(()=>snapshot&&run?coverageFor(snapshot,run,store):null,[snapshot,run,store]);
 const unmeasuredLocalTypes=useMemo(()=>snapshot&&!run?snapshot.types.map(type=>({
  ...type, coveragePercent:null, coveredFields:null,
  fields:type.fields.map(field=>({...field, covered:null, hits:null})),
 })):emptyGraphTypes,[snapshot,run]);
 const operations=useMemo(()=>snapshot?operationsFor(store,snapshot,requests):[],[store,snapshot,requests]);
 const snapshotGraph=remoteGraph.kind==='ready'?remoteGraph.data:null;
 const remoteGraphData=runCoverage.data??snapshotGraph;
 const remoteTypes=useMemo(()=>remoteGraphData?schemaGraphTypes(remoteGraphData):emptyGraphTypes,[remoteGraphData]);
 const graphTypes=mockSelected?coverage?.types??unmeasuredLocalTypes:remoteTypes;
 const coverageSummary=coverage?.summary??runCoverage.data?.summary??null;
 const coverageAvailable=coverageSummary!==null;
 const isSdlTab=page==='schema'&&detail?.kind==='type'&&currentStep(schemaHistory)?.tab==='SDL';
 const remoteSdl=useBackendSdl(remoteGraphData&&isSdlTab?remoteGraphData.schemaId:null,graphScope);
 const detailSnapshot=remoteSdl.state.kind==='ready'?{sdl:remoteSdl.state.data}:snapshot;
 const sdlMessage=remoteSdl.state.kind==='error'?remoteSdl.state.error.message:
  remoteSdl.state.kind==='loading'?'Загружаем SDL…':undefined;
 const schemaError=remoteList.kind==='error'?remoteList.error:remoteGraph.kind==='error'?remoteGraph.error:null;
 const readErrorStatus=runCoverage.error?.status??(stats.error instanceof ApiError?stats.error.status:undefined)??schemaError?.status??(remoteSdl.state.kind==='error'?remoteSdl.state.error.status:undefined);
 useEffect(()=>{if(session&&readErrorStatus===401)void restore()},[session,readErrorStatus,restore]);

 const coverageNotice=runCoverage.loading
  ? (runCoverage.data?'Обновляем покрытие…':'Загружаем покрытие прогона…')
  : runCoverage.error?coverageErrorMessage(runCoverage.error):null;
 const summaryErrors=runAnalyticsErrors(runCoverage.error,stats.error,
  runCoverage.data?' Показано последнее доступное покрытие.':snapshotGraph?' Показана структура схемы.':'');
 const snapshotStatus=remoteList.kind==='error'?'Ошибка загрузки':remoteList.kind==='ready'?'Снимков нет':'Загрузка…';
 const remoteMessage=coverageNotice??schemaError?.message??(remoteList.kind==='ready'&&remote.items.length===0
  ?'У этого сервиса пока нет снимков схемы. Откройте селектор «Снимок схемы», чтобы импортировать SDL или загрузить схему через introspection.'
  :remoteGraph.kind==='loading'?'Загружаем граф схемы…':'Загружаем снимки схемы…');
 const resetSchemaNavigation=useCallback(()=>{
  setSchemaHistory(emptyHistory);
  setDetail(null);
  setHoveredField(null);
  setOperationField('');
  setRequestField('');
  setRequestOperation('');
 },[]);
 const resetSchemaFilters=useCallback(()=>{
  setQuery('');
  setFieldFilter('all');
  setSort('date');
 },[]);
 const lastAuthRevision=useRef(auth.revision);
 useEffect(()=>{
  if(lastAuthRevision.current===auth.revision)return;
  lastAuthRevision.current=auth.revision;
  if(!mockSelected){resetSchemaNavigation();resetSchemaFilters()}
 },[auth.revision,mockSelected,resetSchemaNavigation,resetSchemaFilters]);
 const selectService=(id:string,local:boolean)=>{
  if(id===serviceId)return;
  pendingRestore.current=null;
  const firstRun=local?store.runs.find(item=>item.serviceId===id):undefined;
  const firstSnapshot=local?store.snapshots.find(item=>item.serviceId===id):undefined;
  setServiceId(id);
  setApiRunSelection(null);
  setFinishRequest(null);
  setServiceVersion(version=>version+1);
  if(!local)setPage('schema');
  setRunId(firstRun?.id??'');
  setSnapshotId(firstRun?.snapshotId??firstSnapshot?.id??'');
  resetSchemaNavigation();
  resetSchemaFilters();
  setMessage('');
 };
 const chooseService=(id:string)=>{
  const service=catalog.services.find(item=>item.id===id);
  if(service)selectService(id,service.source==='mock');
 };
 const submitService=async(input:ServiceCreate)=>{
  const current=auth.getCurrent();
  if(current.pending||current.revision!==auth.revision||!canCreateService(current.session)){
   throw new ApiError('http','Сессия недоступна.',401);
  }
  try{
   const created=await createService(input,current.session.csrfToken);
   const latest=auth.getCurrent();
   if(latest.revision!==current.revision||latest.pending||!canCreateService(latest.session))return;
   catalog.refreshAfterCreate(created);
   selectService(created.id,false);
   setMessage('Сервис добавлен');
  }catch(error){
   if(error instanceof ApiError&&(error.status===401||error.status===403))void restore();
   throw error;
  }
 };
 const submitServiceEdit=async(id:string,input:ServiceUpdate)=>{
  const current=auth.getCurrent();
  if(current.pending||current.revision!==auth.revision||!canCreateService(current.session)){
   throw new ApiError('http','Сессия недоступна.',401);
  }
  try{
   const updated=await updateService(id,input,current.session.csrfToken);
   if(auth.getCurrent().revision!==current.revision)return;
   catalog.replaceService(updated);
   setMessage('Настройки сервиса сохранены');
  }catch(error){
   if(error instanceof ApiError&&error.status===401)void restore();
   throw error;
  }
 };
 const hadSession=useRef(Boolean(session));
 useEffect(()=>{
  const signedOut=hadSession.current&&!session;
  hadSession.current=Boolean(session);
  const unavailable=catalog.state.kind==='ready'&&!catalog.services.some(service=>service.id===serviceId);
  if(mockSelected||(!signedOut&&!unavailable))return;
  const firstRun=store.runs.find(item=>item.serviceId===MOCK_SERVICE_ID);
  setServiceId(MOCK_SERVICE_ID);
  setApiRunSelection(null);
  setFinishRequest(null);
  setServiceVersion(version=>version+1);
  setRunId(firstRun?.id??'');
  setSnapshotId(firstRun?.snapshotId??'');
  resetSchemaNavigation();
  resetSchemaFilters();
 },[catalog.services,catalog.state,mockSelected,serviceId,session,store.runs,resetSchemaNavigation,resetSchemaFilters]);
 const chooseRun=(id:string)=>{const next=mockRuns.find(r=>r.id===id);setRunId(id);if(next){setServiceId(next.serviceId);setSnapshotId(next.snapshotId);if(next.snapshotId!==snapshot?.id)resetSchemaNavigation()}else resetSchemaNavigation();setRequestFilter('all');setRequestField('');setRequestOperation('')};
 const chooseSnapshot=(id:string)=>{
  if(id===schemaId||!snapshots.some(item=>item.id===id))return;
  pendingRestore.current=null;
  setSnapshotId(id);
  setApiRunSelection(null);
  setFinishRequest(null);
  setSnapshotVersion(version=>version+1);
  if(run?.snapshotId!==id)setRunId('');
  resetSchemaNavigation();
  resetSchemaFilters();
  setPage('schema');
 };
 const centerSchemaElement=(typeName:string,fieldName?:string)=>requestAnimationFrame(()=>requestAnimationFrame(()=>{const node=flow.getNode(typeName);if(!node)return;const fieldIndex=fieldName?graphTypes.find(type=>type.name===typeName)?.fields.findIndex(field=>field.name===fieldName)??-1:-1;const zoom=flow.getZoom()<.68?.9:Math.min(flow.getZoom(),1.15);const x=node.position.x+(node.measured?.width??310)/2+(window.innerWidth<=900?Math.min(430,window.innerWidth-24)/(2*zoom):0);const y=fieldIndex>=0?node.position.y+96+fieldIndex*39:node.position.y+Math.min((node.measured?.height??240)/2,185);void flow.setCenter(x,y,{zoom,duration:420})}));
 const navigateSchema=(kind:'type'|'field',id:string,edgeId:string|null=null)=>{const viewport=flow.getViewport();setSchemaHistory(old=>pushStep(updateStep(old,{viewport}),{kind,id,edgeId,tab:'Обзор',viewport}));setDetail({kind,id});centerSchemaElement(kind==='type'?id:id.split('.')[0],kind==='field'?id.split('.').slice(1).join('.'):undefined)};
 const openField=(t:string,f:string)=>navigateSchema('field',fieldId(t,f));
 const openType=(t:string,edgeId:string|null=null)=>navigateSchema('type',t,edgeId);
 const travelSchema=(direction:-1|1)=>{const next=moveStep(updateStep(schemaHistory,{viewport:flow.getViewport()}),direction);if(next===schemaHistory||next.index===schemaHistory.index)return;setSchemaHistory(next);const step=currentStep(next)!;setDetail({kind:step.kind,id:step.id});setMode('graph');requestAnimationFrame(()=>requestAnimationFrame(()=>{void flow.setViewport(step.viewport,{duration:300})}))};
 const changeSchemaTab=(tab:'Обзор'|'Связи'|'SDL')=>setSchemaHistory(old=>updateStep(old,{tab}));
 const goOperations=(field:string)=>{setBackendNavigation(value=>value+1);setBackendOperationKey('');setPage('operations');setOperationField(field);setOperationKind('all');setOperationErrors(false);setQuery('');setDetail(null)};
 const goRequests=(filter:RequestFilter='all',field='',operation='')=>{setBackendNavigation(value=>value+1);setPage('requests');setRequestFilter(filter);setRequestField(field);setRequestOperation(operation);setOperationKind('all');setSort('date');setQuery('');setDetail(null)};
 const summaryAction=(key:string)=>{if(key==='zero-types'){setPage('schema');setMode('graph');setExplorerRequest(value=>value+1);setDetail(null);return}if(key==='operations'){goOperations('');return}const target=summaryDestination(key);setDetail(null);setQuery('');if(target.page==='schema'){setPage('schema');setMode(target.mode as 'graph'|'table');setFieldFilter(target.filter as CoverageFilter)}else{goRequests(target.filter as RequestFilter);if('sort'in target&&target.sort)setSort(target.sort)}};
 const applyImportedSnapshot=(id:string)=>{
  setSnapshotId(id);
  setApiRunSelection(null);
  setFinishRequest(null);
  setSnapshotVersion(version=>version+1);
  setRunId('');
  resetSchemaNavigation();
  resetSchemaFilters();
  setPage('schema');
  setMode('graph');
 };
 const submitSnapshotName=async(displayName:string|null)=>{
  const current=auth.getCurrent();
  if(current.pending||current.revision!==auth.revision||!canCreateService(current.session)){
   throw new ApiError('http','Сессия недоступна.',401);
  }
  if(!remote.selected)throw new ApiError('http','Снимок недоступен.',404);
  try{
   const updated=await renameSchema(remote.selected,displayName,current.session.csrfToken);
   if(auth.getCurrent().revision===current.revision)remote.replaceSnapshot(updated);
  }catch(error){
   if(error instanceof ApiError&&error.status===401)void restore();
   throw error;
  }
 };
 const importSnapshot=async(input:SnapshotImport)=>{
  if(mockSelected){
   if(input.method!=='sdl')throw new Error('Для mock-сервиса доступен импорт SDL.');
   const imported=snapshotFromSDL(input.sdl,serviceId,input.fileName??'Вставленный SDL',crypto.randomUUID());
   setStore(previous=>({...previous,snapshots:[...previous.snapshots,imported]}));
   applyImportedSnapshot(imported.id);
   setMessage('Схема импортирована локально');
   return;
  }
  const current=auth.getCurrent();
  if(current.pending||current.revision!==intent?.revision||!canCreateService(current.session)){
   throw new ApiError('http','Импорт недоступен для текущей сессии.',current.session?403:401);
  }
  if(!remoteService)throw new ApiError('http','Сервис недоступен.',404);
  try{
   const token=current.session.csrfToken;
   const imported=input.method==='sdl'
    ?await importSchemaSdl(remoteService.id,input.sdl,token)
    :await importSchemaIntrospection(remoteService.id,token);
   const latest=auth.getCurrent();
   if(latest.revision!==current.revision||latest.pending||!canCreateService(latest.session))return;
   remote.snapshots.retry();
   applyImportedSnapshot(imported.id);
   setMessage('Снимок схемы готов');
  }catch(error){
   if(error instanceof ApiError&&(error.status===401||error.status===403))void restore();
   throw error;
  }
 };
 const createRun=()=>{if(!snapshot)return;const name=prompt('Название локального прогона');if(!name?.trim())return;const next:Run={id:crypto.randomUUID(),name:name.trim(),serviceId,snapshotId:snapshot.id,status:'active',startedAt:new Date().toISOString(),endedAt:null};setStore(s=>({...s,runs:[...s.runs,next]}));chooseRun(next.id);setRunId(next.id);setMessage('Локальный прогон создан')};
 const chooseApiRun=(next:RunOut)=>{
  const selection=remoteService?runSelectionForHistory(next,serviceScope,remote.items):null;
  if(!selection)return;
  pendingRestore.current=null;
  if(schemaId!==next.snapshotId)chooseSnapshot(next.snapshotId);
  if(apiRun?.id!==next.id){setCoverageVersion(version=>version+1);setOperationField('');setRequestField('');setRequestOperation('');setRequestFilter('all');setBackendOperationKey('');}
  setApiRunSelection(selection);
  setPage('schema');
  setMode('graph');
 };
 const submitApiRun=async(name:string)=>{
  const current=auth.getCurrent();
  if(current.pending||current.revision!==intent?.revision||!canCreateService(current.session)){
   throw new ApiError('http','Создание прогона недоступно.',current.session?403:401);
  }
  if(!remoteService||!schemaId)throw new ApiError('http','Снимок недоступен.',404);
  try{
   const created=await postRun(schemaId,name,current.session.csrfToken);
   const latest=auth.getCurrent();
   if(latest.revision!==current.revision||latest.pending||!canCreateService(latest.session))return null;
   chooseApiRun(created);
   refreshHistory();
   return created;
  }catch(error){
   if(error instanceof ApiError){
    if(error.status===401) setMessage(runActionError(error,'create'));
    if(error.status===401||error.status===403)void restore();
    if(error.status===409)refreshHistory();
   }
   throw error;
  }
 };
 const completeApiRun=async()=>{
  const current=auth.getCurrent();
  if(current.pending||current.revision!==auth.revision||!canCreateService(current.session)){
   throw new ApiError('http','Завершение прогона недоступно.',current.session?403:401);
  }
  if(!apiRun||apiRun.id!==finishTarget?.id||apiRun.status!=='running'){
   throw new ApiError('http','Прогон уже не активен.',409);
  }
  try{
   const finished=await postFinishRun(apiRun,current.session.csrfToken);
   const latest=auth.getCurrent();
   if(latest.revision!==current.revision||latest.pending||!canCreateService(latest.session))return;
   setApiRunSelection({scope:serviceScope,run:finished});
   refreshHistory();
   setMessage('Прогон завершён');
  }catch(error){
   if(error instanceof ApiError){
    if(error.status===401) setMessage(runActionError(error,'finish'));
    if(error.status===401||error.status===403)void restore();
    if(error.status===409||error.status===404||error.kind!=='http'||(error.status??0)>=500){
     setApiRunSelection(previous=>previous?.scope===serviceScope&&previous.run.id===apiRun.id?null:previous);
     refreshHistory();
    }
   }
   throw error;
  }
 };
 const requestAction=(action:WorkspaceAction)=>{
  const current=auth.getCurrent();
  const outcome=workspaceActionFor(action,current.session,mockSelected);
  if(outcome==='local-run'){createRun();return}
  setActionRequest({action,outcome,revision:current.revision,serviceId});
 };
 const closeAction=()=>setActionRequest(current=>current===actionRequest?null:current);
 const finishRun=()=>{if(!run||run.status!=='active')return;setStore(s=>({...s,runs:s.runs.map(r=>r.id===run.id?{...r,status:'completed',endedAt:new Date().toISOString()}:r)}));setMessage('Локальный прогон завершён')};
 const nodesReady=useNodesInitialized();const fittedSnapshot=useRef('');const [hoveredField,setHoveredField]=useState<string|null>(null);
 const [nodePositions,setNodePositions]=useState<Record<string,{x:number;y:number}>>({});
 const [nodeMeasurements,setNodeMeasurements]=useState<Record<string,{width:number;height:number}>>({});
 const onNodesChange=useCallback((changes:NodeChange<TypeFlowNode>[])=>{const key=(id:string)=>(schemaId??'')+':'+id;const positions=changes.filter(c=>c.type==='position'&&c.position);if(positions.length)setNodePositions(old=>{const next={...old};for(const change of positions)if(change.type==='position'&&change.position)next[key(change.id)]=change.position;return next});const dimensions=changes.filter(c=>c.type==='dimensions'&&c.dimensions);if(dimensions.length)setNodeMeasurements(old=>{const next={...old};let changed=false;for(const change of dimensions)if(change.type==='dimensions'&&change.dimensions){const id=key(change.id),size=change.dimensions;if(next[id]?.width!==size.width||next[id]?.height!==size.height){next[id]=size;changed=true}}return changed?next:old})},[schemaId]);
 const graph=useMemo(()=>{
  if(!graphTypes.length)return {nodes:[] as TypeFlowNode[],edges:[] as Edge[]};
  const positions=layout({types:graphTypes}),relations=graphEdges({types:graphTypes});
  const incoming=new Map<string,string[]>();
  for(const edge of relations)incoming.set(edge.target,[...(incoming.get(edge.target)??[]),edge.id]);
  const boxes=graphTypes.map(type=>{const position=nodePositions[(schemaId??'')+':'+type.name]??positions.find(node=>node.id===type.name)!.position;const measured=nodeMeasurements[(schemaId??'')+':'+type.name];return {id:type.name,x:position.x,y:position.y,width:measured?.width??310,height:measured?.height??105+type.fields.length*39}});
  const activeType=detail?.kind==='type'?detail.id:null;
  const activeField=detail?.kind==='field'?detail.id:null;
  const selectedEdgeId=detail?.kind==='type'||detail?.kind==='field'?currentStep(schemaHistory)?.edgeId:null;
  const sourceType=activeField?.split('.')[0]??null;
  const selectedRelation=activeField?relations.find(edge=>edge.sourceHandle==='field:'+activeField):null;
  const hasSelection=Boolean(activeType||activeField);
  const visibleNodes=new Set<string>();
  if(activeType){visibleNodes.add(activeType);for(const edge of relations)if(edge.source===activeType||edge.target===activeType){visibleNodes.add(edge.source);visibleNodes.add(edge.target)}}
  if(sourceType){visibleNodes.add(sourceType);if(selectedRelation)visibleNodes.add(selectedRelation.target)}
  if(selectedEdgeId){const relation=relations.find(edge=>edge.id===selectedEdgeId);if(relation){visibleNodes.add(relation.source);visibleNodes.add(relation.target)}}
  const nodes:TypeFlowNode[]=graphTypes.map(type=>({
   id:type.name,type:'type',
   position:nodePositions[(schemaId??'')+':'+type.name]??positions.find(node=>node.id===type.name)!.position,
   measured:nodeMeasurements[(schemaId??'')+':'+type.name],
   style:{opacity:hasSelection&&!visibleNodes.has(type.name)?.3:1},
   data:{schemaType:type,incoming:incoming.get(type.name)??[],selectedType:activeType??sourceType,selectedField:activeField,selectedTarget:selectedRelation?.target??null,hoveredField,hoveredTarget:relations.find(edge=>edge.sourceHandle==='field:'+hoveredField)?.target??null,onType:openType,onField:openField,onHoverField:setHoveredField}
  }));
  const edges:Edge[]=relations.map((edge,index)=>{
   const field=edge.sourceHandle.replace('field:','');
   const selected=selectedEdgeId?edge.id===selectedEdgeId:activeField?activeField===field:activeType?edge.source===activeType||edge.target===activeType:false;
   const hovered=hoveredField===field;
   const dimmed=!hovered&&(hasSelection?!selected:Boolean(hoveredField));
   const stroke=selected||hovered?'var(--graph-edge-active)':edge.covered?'var(--graph-edge-covered)':'var(--graph-edge-muted)';
   return {id:edge.id,source:edge.source,target:edge.target,sourceHandle:edge.sourceHandle,targetHandle:'target:'+edge.id,ariaLabel:edge.covered===undefined?undefined:`${field} → ${edge.target}: ${edge.covered?'Покрыто':'Не покрыто'}`,type:'routed',data:{offset:(index%4)*6,obstacles:boxes.filter(box=>box.id!==edge.source&&box.id!==edge.target)},markerEnd:{type:MarkerType.ArrowClosed,width:12,height:12,color:stroke},style:{stroke,strokeWidth:selected||hovered?2.4:1.25,opacity:dimmed?.14:1}};
  });
  return {nodes,edges};
 },[graphTypes,detail,hoveredField,nodePositions,nodeMeasurements,schemaId,schemaHistory]);
 const focusExplorer=(typeName:string,fieldName?:string,edgeId?:string)=>{if(fieldName)openField(typeName,fieldName);else openType(typeName,edgeId);setMode('graph')};
 const clearExplorerSelection=()=>{setDetail(null);setHoveredField(null)};
 const showOverview=()=>{clearExplorerSelection();setMode('graph');requestAnimationFrame(()=>requestAnimationFrame(()=>{void flow.fitView({padding:.12,minZoom:.3,maxZoom:1,duration:420})}))};
 const viewKey=mockSelected
  ?`mock:${serviceVersion}:${snapshotVersion}:${schemaId??'none'}`
  :`backend:${graphScope}:${schemaId??'none'}`;
 useEffect(()=>{
  if(page!=='schema'||mode!=='graph'||!schemaId||!nodesReady||!graph.nodes.length||
    !graph.nodes.every(node=>node.measured)||fittedSnapshot.current===viewKey)return;
  const frame=requestAnimationFrame(()=>{
   fittedSnapshot.current=viewKey;
   if(graph.nodes.length>6)void flow.setViewport({x:36,y:28,zoom:.72},{duration:250});
   else void flow.fitView({padding:.12,minZoom:.1,maxZoom:1,duration:250});
  });
  return ()=>cancelAnimationFrame(frame);
 },[page,mode,schemaId,viewKey,nodesReady,graph.nodes,flow]);
 const visibleOps=operations.filter(o=>o.name.toLowerCase().includes(query.toLowerCase())&&(operationKind==='all'||o.kind===operationKind)&&(!operationErrors||o.httpErrors+o.graphqlErrors>0)&&(!operationField||o.fields.some(ref=>fieldId(ref.type,ref.field)===operationField))).sort((a,b)=>sort==='duration'?b.averageMs-a.averageMs:sort==='errors'?b.httpErrors+b.graphqlErrors-a.httpErrors-a.graphqlErrors:b.count-a.count);
 const visibleRequests=requests.filter(r=>{const op=store.operations.find(o=>o.id===r.operationId);return (op?.name.toLowerCase().includes(query.toLowerCase())??false)&&(requestFilter==='all'||requestFilter==='http'&&r.httpStatus>=400||requestFilter==='graphql'&&r.graphqlErrors.length>0||requestFilter==='analyzer'&&!!r.analyzerError)&&(!requestField||r.hasData&&!r.analyzerError&&op?.fields.some(f=>fieldId(f.type,f.field)===requestField))&&(!requestOperation||r.operationId===requestOperation)&&(operationKind==='all'||op?.kind===operationKind)}).sort((a,b)=>sort==='duration'?b.durationMs-a.durationMs:b.at.localeCompare(a.at));
 const history=mockRuns.filter(r=>r.name.toLowerCase().includes(query.toLowerCase())&&(operationKind==='all'||r.status===operationKind)).sort((a,b)=>sort==='coverage'?(coverageFor(store.snapshots.find(s=>s.id===b.snapshotId)!,b,store).summary.coveragePercent-coverageFor(store.snapshots.find(s=>s.id===a.snapshotId)!,a,store).summary.coveragePercent):b.startedAt.localeCompare(a.startedAt));
 const selectedOp=detail?.kind==='operation'?store.operations.find(o=>o.id===detail.id):null;const selectedRequest=detail?.kind==='request'?store.observations.find(o=>o.id===detail.id):null;
 const realAnalytics=apiRun&&(page==='operations'||page==='requests')&&(()=>{
  const Analytics=page==='operations'?BackendOperations:BackendRequests;
  return <Analytics key={JSON.stringify([analysisScope,page,backendNavigation])} scope={analysisScope!} revision={analysisRevision}
   runId={apiRun.id} role={session?.user.role} field={page==='operations'?operationField:requestField}
   operationKey={page==='operations'?backendOperationKey:requestOperation} filter={requestFilter} sort={sort} types={graphTypes} stats={stats.data}
   onField={(type,field)=>{setPage('schema');focusExplorer(type,field)}}
   onRequests={key=>goRequests('all','',key)} onOperation={key=>{goOperations('');setBackendOperationKey(key)}}
   onClearContext={()=>{if(page==='operations')setOperationField('');else {setRequestField('');setRequestOperation('')}}}
   />;
 })();
 return <div className="analytics-app"><TopChrome adminOpen={adminOpen} onAdmin={()=>setAdminRevision(auth.revision)} canFinish={canFinishRun} coverageRefreshing={runCoverage.loading} contextRefreshing={!apiRun&&(remote.graph.refreshing||remote.snapshots.refreshing)} intent={intent} onAction={requestAction} onCloseAction={closeAction} auth={auth} catalog={catalog} mockSelected={mockSelected} serviceId={serviceId} snapshots={snapshots} snapshot={selectedSnapshot} snapshotStatus={snapshotStatus} run={run} apiRun={apiRun} onCreateRun={submitApiRun} onFinishRun={()=>{if(mockSelected){finishRun();return}if(apiRun?.status==='running')setFinishRequest({scope:serviceScope,run:apiRun})}} metrics={metrics} backendStats={stats.data} statsLoading={stats.loading} summaryErrors={summaryErrors} onRefresh={refreshContext} onRefreshSummary={refreshRunAnalytics} coverage={coverageSummary} schemaFieldCount={coverageSummary?.totalFields??snapshotGraph?.summary.totalFields??(snapshot?graphTypes.reduce((sum,type)=>sum+type.totalFields,0):null)} page={page} onService={chooseService} onCreateService={submitService} onEditService={submitServiceEdit} onSnapshot={chooseSnapshot} onImport={importSnapshot} onRenameSnapshot={submitSnapshotName} snapshotDisplayName={remote.selected?.displayName} onPage={next=>{if(!mockSelected&&next==='operations'){goOperations('');return}if(!mockSelected&&next==='requests'){goRequests();return}setPage(next);setQuery('');setDetail(null);setOperationKind('all');setSort('date')}} onMetric={summaryAction}/>{message&&<div className="toast" role="status">{message}<button onClick={()=>setMessage('')}>×</button></div>}{adminOpen?<AdminUsers key={auth.revision} auth={auth} services={catalog.services.filter(service=>service.source==='backend')} onClose={()=>setAdminRevision(null)}/>:<main className={`analytics-main page-${page}`} aria-labelledby={`analytics-section-${page}`}>{page==='history'&&<div className="view-heading"><h1 id="analytics-section-history">История прогонов</h1></div>}<div className="view-body">{!mockSelected&&page==='history'&&remoteService
  ?<BackendRunHistory key={`${serviceScope}:${historyVersion}`} serviceId={remoteService.id} snapshots={snapshots}
    snapshotsReady={remoteList.kind!=='loading'} selectedId={apiRun?.id} onSelect={chooseApiRun}/>
  :realAnalytics?realAnalytics:!mockSelected&&(page!=='schema'||!remoteGraphData)?<div className="content-panel">
  {page==='history'?<Empty text={catalog.state.kind==='error'?catalog.state.error.message:'Загружаем выбранный сервис…'}/>:
   page!=='schema'?<Empty text="Выберите прогон в истории, чтобы открыть аналитику."/>:
   <div className="empty-state" role={runCoverage.error||schemaError&&!runCoverage.loading?'alert':'status'}>
    <p>{!remoteService&&catalog.state.kind==='error'?catalog.state.error.message:remoteMessage}</p>
    {schemaError&&!runCoverage.loading&&<button type="button" onClick={remoteList.kind==='error'?remote.snapshots.retry:remote.graph.retry}>Повторить</button>}
   </div>}
 </div>:page==='schema'?<><SchemaExplorer key={viewKey} types={graphTypes} coverageAvailable={coverageAvailable} emptyMessage={mockSelected?undefined:'В графе снимка нет типов.'} coverageRequest={explorerRequest} selectedType={detail?.kind==='type'?detail.id:detail?.kind==='field'?detail.id.split('.')[0]:null} selectedField={detail?.kind==='field'?detail.id:null} onType={name=>focusExplorer(name)} onField={(type,field)=>focusExplorer(type,field)} onClear={clearExplorerSelection} onOverview={showOverview}/><div className="content-panel">
  <div className="panel-tools schema-panel-tools">
   <span>{graphTypes.length} типов · {graph.edges.length} связей</span>
   <div className="schema-view-actions">
    <div className="segmented" role="group" aria-label="Режим просмотра схемы">
     <button className={mode==='graph'?'active':''} aria-pressed={mode==='graph'} onClick={()=>setMode('graph')}>Граф</button>
     <button className={mode==='table'?'active':''} aria-pressed={mode==='table'} onClick={()=>setMode('table')}>Таблица</button>
    </div>
   </div>
  </div>
 {mode==='graph'?<><div className="flow-space">{!schemaId&&<div className="schema-empty-hint">Схем пока нет. Добавьте снимок через селектор в верхней панели.</div>}{!mockSelected&&!graphTypes.length&&<div className="schema-empty-hint">В графе снимка нет типов.</div>}<ReactFlow key={viewKey} nodes={graph.nodes} onNodesChange={onNodesChange} edges={graph.edges} onEdgeMouseEnter={(_,edge)=>setHoveredField(edge.sourceHandle?.replace(/^field:/,'')??null)} onEdgeMouseLeave={()=>setHoveredField(null)} onEdgeClick={(_,edge)=>{const field=edge.sourceHandle?.replace(/^field:/,'');if(!field)return;const dot=field.indexOf('.');if(dot>=0)openField(field.slice(0,dot),field.slice(dot+1))}} nodeTypes={{type:TypeNode}} edgeTypes={{routed:RoutedEdge}} nodesConnectable={false}><Background gap={18} color="var(--graph-dot)"/><GraphControls hasNodes={graph.nodes.length>0}/></ReactFlow></div></>:<SchemaCoverageTable
  key={viewKey}
  sdl={snapshot?.sdl}
  types={graphTypes}
  coverageAvailable={coverageAvailable}
  query={query}
  filter={fieldFilter}
  sort={sort}
  selectedField={detail?.kind === 'field' ? detail.id : null}
  onQuery={setQuery}
  onFilter={setFieldFilter}
  onSort={setSort}
  onField={openField}
 /> }</div></>:page==='operations'?<div className="content-panel"><div className="panel-tools"><input placeholder="Поиск операции" value={query} onChange={e=>setQuery(e.target.value)}/><select value={operationKind} onChange={e=>setOperationKind(e.target.value)}><option value="all">Все типы</option><option>Query</option><option>Mutation</option></select><label><input type="checkbox" checked={operationErrors} onChange={e=>setOperationErrors(e.target.checked)}/> С ошибками</label><select value={sort} onChange={e=>setSort(e.target.value)}><option value="date">По частоте</option><option value="duration">По времени</option><option value="errors">По ошибкам</option></select><button onClick={()=>{setQuery('');setOperationKind('all');setOperationErrors(false);setOperationField('')}}>Сбросить</button></div>{operationField&&<div className="active-filter">Поле: {operationField} <button onClick={()=>setOperationField('')}>×</button></div>}{visibleOps.length?<OperationsTable selectedId={detail?.kind==='operation'?detail.id:undefined}
    onSelect={id=>{setDetail({kind:'operation',id});setDetailTab('Информация')}}
    rows={visibleOps.map(op=>({
      id:op.id,name:op.name,kind:op.kind==='Query'?'query':'mutation',
      count:op.count,httpErrors:op.httpErrors,graphqlErrors:op.graphqlErrors,
      averageMs:op.averageMs,fieldCount:op.fields.length,
    }))}/>:<Empty text="Операции не найдены"/>}</div>:page==='requests'?<div className="content-panel"><div className="panel-tools"><input placeholder="Имя операции" value={query} onChange={e=>setQuery(e.target.value)}/><select value={operationKind} onChange={e=>setOperationKind(e.target.value)}><option value="all">Query и Mutation</option><option>Query</option><option>Mutation</option></select><select value={requestFilter} onChange={e=>setRequestFilter(e.target.value as RequestFilter)}><option value="all">Все статусы</option><option value="http">HTTP 4xx/5xx</option><option value="graphql">GraphQL-ошибки</option><option value="analyzer">Ошибки анализа</option></select><select value={requestField} onChange={e=>setRequestField(e.target.value)}><option value="">Все поля</option>{coverage?.types.flatMap(t=>t.fields.map(f=><option key={fieldId(t.name,f.name)} value={fieldId(t.name,f.name)}>{fieldId(t.name,f.name)}</option>))}</select><select value={sort} onChange={e=>setSort(e.target.value)}><option value="date">Сначала новые</option><option value="duration">Долгие сначала</option></select><button onClick={()=>{setQuery('');setRequestFilter('all');setRequestField('');setRequestOperation('');setOperationKind('all')}}>Сбросить</button></div>{requestOperation&&<div className="active-filter">Структура операции: {store.operations.find(o=>o.id===requestOperation)?.name} <button onClick={()=>setRequestOperation('')}>×</button></div>}<div className="table-scroll"><table><thead><tr><th>Дата и время</th><th>Операция</th><th>Тип</th><th>HTTP</th><th>GraphQL</th><th>Длительность</th><th>Анализ</th></tr></thead><tbody>{visibleRequests.map(r=>{const op=store.operations.find(o=>o.id===r.operationId);return <tr key={r.id} onClick={()=>{setDetail({kind:'request',id:r.id});setDetailTab('Информация')}}><td>{fmt(r.at)}</td><td><b>{op?.name}</b></td><td>{op?.kind}</td><td><Status yes={r.httpStatus<400} label={String(r.httpStatus)}/></td><td>{r.graphqlErrors.length?'Есть':'—'}</td><td>{r.durationMs} мс</td><td>{r.analyzerError?'Ошибка':'Успешно'}</td></tr>})}</tbody></table>{!visibleRequests.length&&<Empty text="Обращения не найдены"/>}</div></div>:<div className="content-panel"><div className="panel-tools"><button onClick={createRun} disabled={!snapshot}>+ Новый прогон</button>{run?.status==='active'&&<button onClick={finishRun}>Завершить прогон</button>}<input placeholder="Поиск прогона" value={query} onChange={e=>setQuery(e.target.value)}/><select value={operationKind} onChange={e=>setOperationKind(e.target.value)}><option value="all">Все статусы</option><option value="active">Активные</option><option value="completed">Завершённые</option></select><select value={sort} onChange={e=>setSort(e.target.value)}><option value="date">По дате</option><option value="coverage">По покрытию</option></select><button onClick={()=>{setQuery('');setOperationKind('all')}}>Сбросить</button></div><div className="table-scroll"><table><thead><tr><th>Прогон</th><th>Статус</th><th>Начало</th><th>Завершение</th><th>Длительность</th><th>Обращения</th><th>HTTP</th><th>GraphQL</th><th>Покрытие</th><th>Схема</th></tr></thead><tbody>{history.map(r=>{const snap=store.snapshots.find(s=>s.id===r.snapshotId)!;const m=metricsFor(requestsFor(store,r.id));const c=coverageFor(snap,r,store);return <tr key={r.id} className={r.id===runId?'selected':''} onClick={()=>{chooseRun(r.id);setPage('schema');setMode('graph')}}><td><b>{r.name}</b></td><td><span className={'run-state '+r.status}>{r.status==='active'?'Активен':'Завершён'}</span></td><td>{fmt(r.startedAt)}</td><td>{fmt(r.endedAt)}</td><td>{duration(r)}</td><td>{m.total}</td><td>{m.httpErrors}</td><td>{m.graphqlErrors}</td><td>{c.summary.coveragePercent.toFixed(2)}%</td><td>{snap.name}</td></tr>})}</tbody></table>{!history.length&&<Empty text="Прогоны не найдены"/>}</div></div>}{page==='schema'&&(detail?.kind==='type'||detail?.kind==='field')&&<SchemaDetailPanel showUsage={mockSelected} showAnalyticsLinks={Boolean(apiRun)} canOpenRequests={mayReadJournal(session?.user.role)} types={graphTypes} snapshot={detailSnapshot} sdlMessage={sdlMessage} operations={operations} requests={requests} history={schemaHistory} onBack={()=>travelSchema(-1)} onForward={()=>travelSchema(1)} onClose={()=>setDetail(null)} onTab={changeSchemaTab} onType={(name,edgeId)=>focusExplorer(name,undefined,edgeId)} onField={(type,field)=>focusExplorer(type,field)} onOperations={goOperations} onRequests={field=>goRequests('all',field)}/>}{detail&&(detail.kind==='operation'||detail.kind==='request')&&<aside className="detail-panel"><div className="detail-head"><strong>Подробности</strong><button onClick={()=>setDetail(null)} aria-label="Закрыть подробности">×</button></div>{detail.kind==='operation'&&selectedOp&&<><small>{selectedOp.kind}</small><h2>{selectedOp.name}</h2><div className="detail-tabs">{['Информация','GraphQL-код'].map(x=><button key={x} className={detailTab===x?'active':''} onClick={()=>setDetailTab(x)}>{x}</button>)}</div>{detailTab==='GraphQL-код'?<CodeView code={selectedOp.document}/>:<><p>Структура: <code>{selectedOp.id}</code></p><p>Выполнений: {operations.find(o=>o.id===selectedOp.id)?.count}</p><h3>Затронутые поля</h3>{selectedOp.fields.map(f=><button className="detail-list-row" key={fieldId(f.type,f.field)} onClick={()=>{setPage('schema');setMode('graph');openField(f.type,f.field)}}>{fieldId(f.type,f.field)}</button>)}<button className="primary" onClick={()=>goRequests('all','',selectedOp.id)}>Показать обращения</button></>}</>}{detail.kind==='request'&&selectedRequest&&<><small>ОБРАЩЕНИЕ · {selectedRequest.id}</small><h2>{store.operations.find(o=>o.id===selectedRequest.operationId)?.name}</h2><div className="detail-tabs">{['Информация','Поля','GraphQL-код','Ошибки'].map(x=><button key={x} className={detailTab===x?'active':''} onClick={()=>setDetailTab(x)}>{x}</button>)}</div>{detailTab==='Информация'?<dl><dt>Дата</dt><dd>{fmt(selectedRequest.at)}</dd><dt>HTTP</dt><dd>{selectedRequest.httpStatus}</dd><dt>GraphQL ошибки</dt><dd>{selectedRequest.graphqlErrors.length}</dd><dt>Длительность</dt><dd>{selectedRequest.durationMs} мс</dd><dt>Анализ</dt><dd>{selectedRequest.analyzerError??'Успешно'}</dd></dl>:detailTab==='Поля'?store.operations.find(o=>o.id===selectedRequest.operationId)?.fields.map(f=><button className="detail-list-row" key={fieldId(f.type,f.field)} onClick={()=>{setPage('schema');setMode('graph');openField(f.type,f.field)}}>{fieldId(f.type,f.field)} →</button>):detailTab==='GraphQL-код'?<CodeView code={selectedRequest.safeDocument}/>:<>{selectedRequest.analyzerError&&<p>{selectedRequest.analyzerError}</p>}{selectedRequest.graphqlErrors.map((e,i)=><p key={i}>{e.message} · {e.path} · {e.line}:{e.column}</p>)}{!selectedRequest.graphqlErrors.length&&!selectedRequest.analyzerError&&<Empty text="Ошибок нет"/>}</>}</>}</aside>}</div></main>}{finishTarget&&<FinishRunDialog key={finishTarget.id} run={finishTarget} onFinish={completeApiRun} onClose={()=>setFinishRequest(null)}/>}</div>}
function Status({yes,label}:{yes:boolean;label?:string}){return <span className={`status ${yes?'ok':'bad'}`}>{label??(yes?'Покрыто':'Не покрыто')}</span>}
function Empty({text}:{text:string}){return <div className="empty-state">{text}</div>}
export default function AnalyticsApp(){return <ReactFlowProvider><Inner/></ReactFlowProvider>}

