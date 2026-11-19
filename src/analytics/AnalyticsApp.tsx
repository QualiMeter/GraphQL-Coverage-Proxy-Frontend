import {useMemo,useState,useCallback,useEffect,useRef} from 'react';
import {ReactFlow,ReactFlowProvider,Background,MarkerType,useReactFlow,useNodesInitialized,type Edge,type NodeChange,type Viewport} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {fieldId, type GraphType} from '../model';
import {graphEdges,layout} from '../graph/transform';
import {TypeNode,type TypeFlowNode} from '../graph/TypeNode';
import {RoutedEdge} from '../graph/RoutedEdge';
import {GraphControls} from './GraphControls';
import {canManageUsers} from '../api/admin';
import {AdminUsers} from './AdminUsers';
import {TopChrome} from './TopChrome';
import {SchemaExplorer} from './SchemaExplorer';
import {SchemaDetailPanel} from './SchemaDetailPanel';
import {SchemaCoverageTable} from './SchemaCoverageTable';
import type {CoverageFilter} from './coverageTableFilters';
import {needsSchemaDetailSdl,currentStep,emptyHistory,moveStep,pushStep,updateStep,type InvestigationHistory} from './schemaInvestigation';
import {availableServiceId,useServiceCatalog} from './serviceCatalog';
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
import {BackendTests} from './BackendTests';
import {defaultTestView,testContextValue,testJournalNavigation,type ContextualTest,type TestListView} from './testCoverageModel';
import type {ExecutionOut} from '../api/testCoverage';
import {analyticsError, mayReadJournal} from './runAnalyticsModel';
import {readWorkspace, saveWorkspace, rememberRun, workspaceOwner} from './workspaceSelection';
import {useAutoRunSelection} from './useAutoRunSelection';
import {BackendRunHistory} from './BackendRunHistory';
import {RunComparison} from './RunComparison';
import type {CiListContext} from './RunHistoryFilters';
import {ExportWorkspace} from './ExportWorkspace';
import {ExportCenter} from './ExportCenter';
import {gitlabCodeMessage,gitlabErrorMessage,launchGitlab,gitlabErrorRunId,type GitlabPipeline} from '../api/gitlab';
import {useGitlabPipeline} from './useGitlabPipeline';
import type {SchemaCoordinate} from '../api/runPaths';
import {pathSearchNavigation,pathForContext,type RequestPathSelection} from './pathSearchNavigation';
import {sameGitlabContext,type GitlabContext} from './gitlabContext';
import {FinishRunDialog} from './RunDialogs';
import {summaryDestination} from './navigation';
import './analytics.css';
import '../graph/graph.css';
import './redesign.css';
import './context.css';
import './workspace.css';
import './workspaceDark.css';
import './profileAdmin.css';
type Page='schema'|'operations'|'requests'|'tests'|'history';
type RequestFilter='all'|'http'|'graphql'|'analyzer';
const emptyGraphTypes:GraphType[]=[];
function Inner({auth,owner}:{auth:ReturnType<typeof useAuth>;owner:string}){const [saved]=useState(()=>readWorkspace(owner));const [serviceId,setServiceId]=useState(saved?.serviceId??''),[snapshotId,setSnapshotId]=useState(saved?.snapshotId??''),[page,setPage]=useState<Page>('schema'),[mode,setMode]=useState<'graph'|'table'>('graph'),[fieldFilter,setFieldFilter]=useState<CoverageFilter>('all'),[query,setQuery]=useState(''),[requestFilter,setRequestFilter]=useState<RequestFilter>('all'),[requestField,setRequestField]=useState(''),[requestOperation,setRequestOperation]=useState(''),[operationField,setOperationField]=useState(''),[sort,setSort]=useState('date'),[detail,setDetail]=useState<{kind:'type'|'field';id:string}|null>(null),[schemaHistory,setSchemaHistory]=useState<InvestigationHistory>(emptyHistory),[explorerRequest,setExplorerRequest]=useState(0),[message,setMessage]=useState('');const flow=useReactFlow();
 const [selectedTest,setSelectedTest]=useState<ContextualTest<string>|null>(null);
 const [testJournal,setTestJournal]=useState<ContextualTest<string>|null>(null);
 const [testListView,setTestListView]=useState<ContextualTest<TestListView>|null>(null);
 const [requestPath,setRequestPath]=useState<RequestPathSelection|null>(null);
 const [comparisonOpen,setComparisonOpen]=useState(false);
 const [comparisonSeed,setComparisonSeed]=useState<(CiListContext&{scope:string;serviceId:string})|null>(null);
 const [adminRevision,setAdminRevision]=useState<number|null>(null);
 const adminOpen=canManageUsers(auth.session)&&adminRevision===auth.revision;
 const {restore,session}=auth;
 const [actionRequest,setActionRequest]=useState<(WorkspaceIntent&{revision:number;serviceId:string})|null>(null);
 const intent=actionRequest?.serviceId===serviceId&&actionRequest.revision===auth.revision?actionRequest:null;
 const catalog=useServiceCatalog(auth.checked?auth.revision:null);
 useEffect(()=>{
  if(session&&catalog.state.kind==='error'&&catalog.state.error.status===401)void restore();
 },[catalog.state,restore,session]);
 const [serviceVersion,setServiceVersion]=useState(0);
 const [snapshotVersion,setSnapshotVersion]=useState(0);
 const serviceScope=`${auth.revision}:${serviceVersion}`;
 const graphScope=`${serviceScope}:${snapshotVersion}`;
 const remoteService=catalog.services.find(service=>service.source==='backend'&&service.id===serviceId);
 const hasPrivateServiceAccess=catalog.state.kind==='ready'&&catalog.state.services.some(service=>service.id===serviceId&&!service.isPublic);
 const canFinishRun=canCreateService(session)&&
  (session.user.role==='admin'||Boolean(remoteService?.endpointUrl)||hasPrivateServiceAccess);
 const remote=useBackendSchema(remoteService?.id??null,snapshotId,serviceScope,graphScope);
 const remoteList=remote.snapshots.state;
 const remoteGraph=remote.graph.state;
 const selectedRemote=remote.selected? snapshotOption(remote.selected):null;
 const selectedSnapshot=selectedRemote;
 const schemaId=selectedSnapshot?.id??null;
 const [apiRunSelection,setApiRunSelection]=useState<RunSelection|null>(null);
 const apiRun=remoteService?selectedRun(apiRunSelection,serviceScope,schemaId):null;
 const testContext=apiRun&&schemaId?{scope:serviceScope,runId:apiRun.id,snapshotId:schemaId}:null;
 const selectedTestId=testContextValue(selectedTest,testContext);
 const journalTestId=testContextValue(testJournal,testContext);
 const activeTestView=testContextValue(testListView,testContext)??defaultTestView;
 const [knownGitlab,setKnownGitlab]=useState<{context:GitlabContext;runId:string;pipeline?:GitlabPipeline}|null>(null);
 const gitlabContext={scope:serviceScope,serviceId,snapshotId:schemaId};
 const gitlabContextRef=useRef(gitlabContext);gitlabContextRef.current=gitlabContext;
 const launchRead=useRef<AbortController|null>(null);
 useEffect(()=>()=>{launchRead.current?.abort()},[serviceScope,schemaId]);
 const pendingGitlab=knownGitlab&&sameGitlabContext(knownGitlab.context,gitlabContext)?knownGitlab:null;
 const trackedRunId=apiRun?.id??pendingGitlab?.runId??null;
 const adoptingGitlab=useRef<string|null>(null);
 const activeRequestPath=pathForContext(requestPath,serviceScope,apiRun?.id,schemaId);
 const [coverageVersion,setCoverageVersion]=useState(0);
 const {coverage:runCoverage,stats,scope:analysisScope,revision:analysisRevision,refresh:refreshRunAnalytics}=
  useRunAnalytics(apiRun,schemaId,`${graphScope}:${coverageVersion}`);
 const autoRun=useAutoRunSelection({owner,serviceId:remoteService?.id??null,scope:serviceScope,snapshots:remote.items,
  ready:remoteList.kind==='ready',enabled:!auth.pending,onResolve:run=>{
   setSnapshotId(run?.snapshotId??remote.items[0]?.id??'');
   setApiRunSelection(run?{scope:serviceScope,run}:null);
  }});
 useEffect(()=>{
  if(!autoRun.resolved||auth.pending||!schemaId)return;
  saveWorkspace({serviceId,snapshotId:schemaId,runId:apiRun?.id??null},owner);
 },[serviceId,schemaId,apiRun?.id,autoRun.resolved,auth.pending,owner]);
 const [backendNavigation,setBackendNavigation]=useState(0);
 const [backendOperationKey,setBackendOperationKey]=useState('');
 const refreshContext=async()=>{
  if(!apiRun){
   if(autoRun.error)autoRun.retry();
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
 const gitlab=useGitlabPipeline(trackedRunId,`${serviceScope}:${schemaId??''}`,(pipeline,signal)=>{
  if(!sameGitlabContext(gitlabContext,gitlabContextRef.current)||signal.aborted)return;
  if(apiRun?.id===pipeline.runId&&!pipeline.trackingFinished)refreshRunAnalytics();
  if(apiRun?.status!==pipeline.runStatus)refreshHistory();
  if(adoptingGitlab.current===pipeline.runId)return;
  if(apiRun?.id===pipeline.runId&&apiRun.status===pipeline.runStatus)return;
  if(!schemaId)return;
  void findRun(schemaId,pipeline.runId,signal).then(next=>{
   if(signal.aborted||!next||!sameGitlabContext(gitlabContext,gitlabContextRef.current))return;
   if(apiRun?.id===next.id)setApiRunSelection({scope:serviceScope,run:next});
   else chooseApiRun(next,false);
  },error=>{if(!signal.aborted&&sameGitlabContext(gitlabContext,gitlabContextRef.current))setMessage(analyticsError(error))});
 },pendingGitlab?.runId===trackedRunId?pendingGitlab.pipeline:undefined,pendingGitlab?.runId===trackedRunId);
 const [dismissedGitlabNotice,setDismissedGitlabNotice]=useState<string|null>(null);
 const gitlabNotices=[
  gitlab.error&&gitlabErrorMessage(gitlab.error),
  gitlab.data?.errorCode&&gitlabCodeMessage(gitlab.data.errorCode),
  gitlab.data?.collectionIncomplete&&'Неполный сбор. Сохранённые обращения доступны, но не представляют полный результат.',
 ].filter(Boolean).join(' ');
 const gitlabNoticeKey=JSON.stringify([serviceScope,schemaId,trackedRunId,gitlabNotices]);
 const showGitlabNotice=!adminOpen&&!comparisonOpen&&trackedRunId&&gitlabNotices&&gitlabNoticeKey!==dismissedGitlabNotice;
 const finalGitlabRefresh=useRef<string|null>(null);
 useEffect(()=>{
  const pipeline=gitlab.data;
  if(!apiRun||!pipeline?.trackingFinished||pipeline.runId!==apiRun.id||pipeline.runStatus!==apiRun.status||stats.loading||runCoverage.loading)return;
  const key=JSON.stringify([serviceScope,schemaId,apiRun.id,apiRun.status,pipeline.finishedAt]);
  if(finalGitlabRefresh.current!==key&&refreshRunAnalytics())finalGitlabRefresh.current=key;
 },[gitlab.data,apiRun,stats.loading,runCoverage.loading,refreshRunAnalytics,serviceScope,schemaId]);
 const snapshots=remote.items.map(snapshotOption);
 const snapshotGraph=remoteGraph.kind==='ready'?remoteGraph.data:null;
 const remoteGraphData=runCoverage.data??snapshotGraph;
 const remoteTypes=useMemo(()=>remoteGraphData?schemaGraphTypes(remoteGraphData):emptyGraphTypes,[remoteGraphData]);
 const graphTypes=remoteTypes;
 const coverageSummary=runCoverage.data?.summary??null;
 const coverageAvailable=coverageSummary!==null;
 const isSdlTab=page==='schema'&&Boolean(detail)&&needsSchemaDetailSdl(currentStep(schemaHistory),graphTypes);
 const remoteSdl=useBackendSdl(remoteGraphData&&isSdlTab?remoteGraphData.schemaId:null,graphScope);
 const detailSnapshot=remoteSdl.state.kind==='ready'?{sdl:remoteSdl.state.data}:null;
 const sdlMessage=remoteSdl.state.kind==='error'?remoteSdl.state.error.message:
  remoteSdl.state.kind==='loading'?'Загружаем SDL…':undefined;
 const schemaError=remoteList.kind==='error'?remoteList.error:remoteGraph.kind==='error'?remoteGraph.error:null;
 const readErrorStatus=(autoRun.error instanceof ApiError?autoRun.error.status:undefined)??runCoverage.error?.status??(stats.error instanceof ApiError?stats.error.status:undefined)??schemaError?.status??(remoteSdl.state.kind==='error'?remoteSdl.state.error.status:undefined)??(gitlab.error instanceof ApiError?gitlab.error.status:undefined);
 useEffect(()=>{if(session&&readErrorStatus===401)void restore()},[session,readErrorStatus,restore]);

 const coverageNotice=runCoverage.loading
  ? (runCoverage.data?'Обновляем покрытие…':'Загружаем покрытие прогона…')
  : runCoverage.error?coverageErrorMessage(runCoverage.error):null;
 const summaryErrors=runAnalyticsErrors(runCoverage.error,stats.error,
  runCoverage.data?' Показано последнее доступное покрытие.':snapshotGraph?' Показана структура схемы.':'');
 const snapshotStatus=!remoteService?'Сервис не выбран':remoteList.kind==='error'?'Ошибка загрузки':remoteList.kind==='ready'?'Снимков нет':'Загрузка…';
 const remoteMessage=coverageNotice??schemaError?.message??(remoteList.kind==='ready'&&remote.items.length===0
  ?'У этого сервиса пока нет снимков схемы. Откройте селектор «Снимок схемы», чтобы импортировать SDL или загрузить схему через introspection.'
  :remoteGraph.kind==='loading'?'Загружаем граф схемы…':'Загружаем снимки схемы…');
 const resetSchemaNavigation=useCallback(()=>{
  setSelectedTest(null);setTestJournal(null);setTestListView(null);
  setRequestPath(null);
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
  resetSchemaNavigation();resetSchemaFilters();
 },[auth.revision,resetSchemaNavigation,resetSchemaFilters]);
 const selectService=useCallback((id:string)=>{
  if(id===serviceId)return;
  setServiceId(id);
  setComparisonOpen(false);
  setApiRunSelection(null);
  setFinishRequest(null);
  setServiceVersion(version=>version+1);
  setPage('schema');
  setSnapshotId('');
  resetSchemaNavigation();
  resetSchemaFilters();
  setMessage('');
 },[serviceId,resetSchemaNavigation,resetSchemaFilters]);
 const chooseService=(id:string)=>{
  const service=catalog.services.find(item=>item.id===id);
  if(service)selectService(id);
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
   selectService(created.id);
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
 useEffect(()=>{
  if(catalog.state.kind!=='ready')return;
  const next=availableServiceId(serviceId,catalog.services);
  if(next===serviceId)return;
  selectService(next);
 },[catalog.state,catalog.services,serviceId,selectService]);
 const chooseSnapshot=(id:string)=>{
  if(id===schemaId||!snapshots.some(item=>item.id===id))return;
  autoRun.cancel();
  setSnapshotId(id);
  setApiRunSelection(null);
  setFinishRequest(null);
  setSnapshotVersion(version=>version+1);
  resetSchemaNavigation();
  resetSchemaFilters();
  setPage('schema');
 };
 const centerSchemaElement=(typeName:string,fieldName?:string)=>requestAnimationFrame(()=>requestAnimationFrame(()=>{const node=flow.getNode(typeName);if(!node)return;const fieldIndex=fieldName?graphTypes.find(type=>type.name===typeName)?.fields.findIndex(field=>field.name===fieldName)??-1:-1;const zoom=flow.getZoom()<.68?.9:Math.min(flow.getZoom(),1.15);const x=node.position.x+(node.measured?.width??310)/2+(window.innerWidth<=900?Math.min(430,window.innerWidth-24)/(2*zoom):0);const y=fieldIndex>=0?node.position.y+96+fieldIndex*39:node.position.y+Math.min((node.measured?.height??240)/2,185);void flow.setCenter(x,y,{zoom,duration:420})}));
 const navigateSchema=(kind:'type'|'field',id:string,edgeId:string|null=null)=>{setRequestPath(null);const viewport=flow.getViewport();setSchemaHistory(old=>pushStep(updateStep(old,{viewport}),{kind,id,edgeId,tab:'Обзор',viewport}));setDetail({kind,id});centerSchemaElement(kind==='type'?id:id.split('.')[0],kind==='field'?id.split('.').slice(1).join('.'):undefined)};
 const openField=(t:string,f:string)=>navigateSchema('field',fieldId(t,f));
 const openType=(t:string,edgeId:string|null=null)=>navigateSchema('type',t,edgeId);
 const travelSchema=(direction:-1|1)=>{const next=moveStep(updateStep(schemaHistory,{viewport:flow.getViewport()}),direction);if(next===schemaHistory||next.index===schemaHistory.index)return;setSchemaHistory(next);const step=currentStep(next)!;setDetail({kind:step.kind,id:step.id});setMode('graph');requestAnimationFrame(()=>requestAnimationFrame(()=>{void flow.setViewport(step.viewport,{duration:300})}))};
 const changeSchemaTab=(tab:'Обзор'|'Связи'|'SDL'|'Тесты'|'Пути')=>setSchemaHistory(old=>updateStep(old,{tab}));
 const goOperations=(field:string)=>{setBackendNavigation(value=>value+1);setBackendOperationKey('');setPage('operations');setOperationField(field);setQuery('');setDetail(null)};
 const goRequests=(filter:RequestFilter='all',field='',operation='')=>{setTestJournal(null);setRequestPath(null);setBackendNavigation(value=>value+1);setPage('requests');setRequestFilter(filter);setRequestField(field);setRequestOperation(operation);setSort('date');setQuery('');setDetail(null)};
 const findRequestsForPath=(path:SchemaCoordinate[])=>{if(!apiRun||!schemaId||!path.length)return;const next=pathSearchNavigation(serviceScope,apiRun.id,schemaId,path);goRequests('all',next.field);setRequestPath(next)};
 const openTests=(executionId?:string)=>{setRequestPath(null);setComparisonOpen(false);setDetail(null);if(testContext&&executionId)setSelectedTest({...testContext,value:executionId});setPage('tests')};
 const showTestRequests=(execution:ExecutionOut)=>{if(!testContext||execution.runId!==testContext.runId)return;const next=testJournalNavigation(testContext,execution.id);goRequests('all',next.field,next.operationKey);setSelectedTest({...testContext,value:next.executionId});setTestJournal({...testContext,value:next.executionId})};
 const summaryAction=(key:string)=>{if(key==='zero-types'){setPage('schema');setMode('graph');setExplorerRequest(value=>value+1);setDetail(null);return}if(key==='operations'){goOperations('');return}const target=summaryDestination(key);setDetail(null);setQuery('');if(target.page==='schema'){setPage('schema');setMode(target.mode as 'graph'|'table');setFieldFilter(target.filter as CoverageFilter)}else{goRequests(target.filter as RequestFilter);if('sort'in target&&target.sort)setSort(target.sort)}};
 const applyImportedSnapshot=(id:string)=>{
  setSnapshotId(id);
  setApiRunSelection(null);
  setFinishRequest(null);
  setSnapshotVersion(version=>version+1);
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
 const chooseApiRun=(next:RunOut,explicit=true)=>{
  const current=auth.getCurrent();
  if(current.pending||current.revision!==auth.revision)return;
  setComparisonOpen(false);
  const selection=remoteService?runSelectionForHistory(next,serviceScope,remote.items):null;
  if(!selection)return;
  autoRun.cancel();
  if(explicit)rememberRun(owner,serviceId,{runId:next.id,snapshotId:next.snapshotId});
  if(schemaId!==next.snapshotId)chooseSnapshot(next.snapshotId);
  if(apiRun?.id!==next.id){setSelectedTest(null);setTestJournal(null);setTestListView(null);setRequestPath(null);setCoverageVersion(version=>version+1);setOperationField('');setRequestField('');setRequestOperation('');setRequestFilter('all');setBackendOperationKey('');}
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
 const submitGitlabRun=async(ref:string,name?:string)=>{
  const current=auth.getCurrent();
  if(current.pending||current.revision!==intent?.revision||!canCreateService(current.session))throw new ApiError('http','Запуск GitLab недоступен для текущей сессии.',current.session?403:401);
  if(!remoteService||!schemaId)throw new ApiError('http','Сервис или снимок недоступен.',404);
  const context=gitlabContext;
  async function adopt(runId:string,pipeline?:GitlabPipeline){
   if(!sameGitlabContext(context,gitlabContextRef.current)||auth.getCurrent().revision!==current.revision)return;
   autoRun.cancel();
   rememberRun(owner,serviceId,{runId,snapshotId:context.snapshotId!});
   setApiRunSelection(null);
   setKnownGitlab({context,runId,pipeline});
   refreshHistory();
   launchRead.current?.abort();
   const controller=new AbortController();launchRead.current=controller;
   adoptingGitlab.current=runId;
   try{
    const run=await findRun(context.snapshotId!,runId,controller.signal);
    if(controller.signal.aborted||!sameGitlabContext(context,gitlabContextRef.current)||auth.getCurrent().revision!==current.revision)return;
    if(run)chooseApiRun(run);
    else setMessage(`Coverage Run ${runId} создан. Обновите историю для выбора прогона.`);
   }catch(error){if(!controller.signal.aborted&&sameGitlabContext(context,gitlabContextRef.current))setMessage(`Coverage Run ${runId}: ${analyticsError(error as Error)} Проверьте историю.`)}
   finally{if(adoptingGitlab.current===runId)adoptingGitlab.current=null}
  }
  try{
   const pipeline=await launchGitlab({serviceId:remoteService.id,snapshotId:schemaId,ref,...(name?{name}:{})},current.session.csrfToken);
   await adopt(pipeline.runId,pipeline);
   return sameGitlabContext(context,gitlabContextRef.current)&&auth.getCurrent().revision===current.revision?pipeline:null;
  }catch(error){
   const runId=gitlabErrorRunId(error);
   if(runId)await adopt(runId);
   if(sameGitlabContext(context,gitlabContextRef.current)){
    if(error instanceof ApiError&&(error.status===401||error.status===403))void restore();
    if(error instanceof ApiError&&error.status===409)refreshHistory();
   }
   throw error;
  }
 };
 const completeApiRun=async()=>{
  const current=auth.getCurrent();
  if(current.pending||current.revision!==auth.revision||!canCreateService(current.session)){
   throw new ApiError('http','Завершение прогона недоступно.',current.session?403:401);
  }
  if(!gitlab.canFinish)throw new ApiError('http','Ручное завершение недоступно: управление прогоном не подтверждено как обычное.',409);
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
  const outcome=workspaceActionFor(action,current.session);
  setActionRequest({action,outcome,revision:current.revision,serviceId});
 };
 const closeAction=()=>setActionRequest(current=>current===actionRequest?null:current);
 const nodesReady=useNodesInitialized();const fittedSnapshot=useRef('');const [hoveredField,setHoveredField]=useState<string|null>(null);
 const [nodePositions,setNodePositions]=useState<Record<string,{x:number;y:number}>>({});
 const [nodeMeasurements,setNodeMeasurements]=useState<Record<string,{width:number;height:number}>>({});
 const onNodesChange=useCallback((changes:NodeChange<TypeFlowNode>[])=>{const key=(id:string)=>(schemaId??'')+':'+id;const positions=changes.filter(c=>c.type==='position'&&c.position);if(positions.length)setNodePositions(old=>{const next={...old};for(const change of positions)if(change.type==='position'&&change.position)next[key(change.id)]=change.position;return next});const dimensions=changes.filter(c=>c.type==='dimensions'&&c.dimensions);if(dimensions.length)setNodeMeasurements(old=>{const next={...old};let changed=false;for(const change of dimensions)if(change.type==='dimensions'&&change.dimensions){const id=key(change.id),size=change.dimensions;if(next[id]?.width!==size.width||next[id]?.height!==size.height){next[id]=size;changed=true}}return changed?next:old})},[schemaId]);
 const pathHighlightContext=JSON.stringify([serviceScope,schemaId,apiRun?.id,page,detail,schemaHistory.index]);
 const [highlightedPath,setHighlightedPath]=useState<{context:string;path:SchemaCoordinate[]}|null>(null);
 const activePath=highlightedPath?.context===pathHighlightContext?highlightedPath.path:null;
 const highlightPath=useCallback((path:SchemaCoordinate[]|null)=>{
  setHighlightedPath(path?{context:pathHighlightContext,path}:null);
  setHoveredField(null);
 },[pathHighlightContext]);
 useEffect(()=>{
  if(!activePath||mode!=='graph'||!nodesReady)return;
  const frame=requestAnimationFrame(()=>{void flow.fitView({
   nodes:[...new Set(activePath.map(step=>step.typeName))].map(id=>({id})),
   padding:.2,maxZoom:1,duration:420,
  })});
  return ()=>cancelAnimationFrame(frame);
 },[activePath,mode,nodesReady,flow]);
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
  const pathFields=activePath?.map(step=>fieldId(step.typeName,step.fieldName));
  const pathEdges=new Set<string>();
  if(activePath){
   visibleNodes.clear();
   for(const step of activePath)visibleNodes.add(step.typeName);
   for(let index=0;index<activePath.length-1;index++){
    const step=activePath[index],next=activePath[index+1];
    const relation=relations.find(edge=>edge.source===step.typeName&&edge.sourceHandle==='field:'+fieldId(step.typeName,step.fieldName)&&edge.target===next.typeName);
    if(relation)pathEdges.add(relation.id);
   }
  }
  const nodes:TypeFlowNode[]=graphTypes.map(type=>{
   const dimmed=hasSelection&&!visibleNodes.has(type.name);
   return {
    id:type.name,type:'type',
    position:nodePositions[(schemaId??'')+':'+type.name]??positions.find(node=>node.id===type.name)!.position,
    measured:nodeMeasurements[(schemaId??'')+':'+type.name],
    draggable:!dimmed,
    className:dimmed?'schema-node-dimmed':undefined,
    style:{opacity:dimmed?.3:1},
    data:{pathFields,schemaType:type,incoming:incoming.get(type.name)??[],selectedType:activeType??sourceType,selectedField:activeField,selectedTarget:activePath?null:selectedRelation?.target??null,hoveredField,hoveredTarget:activePath?null:relations.find(edge=>edge.sourceHandle==='field:'+hoveredField)?.target??null,onType:openType,onField:openField,onHoverField:setHoveredField}
   };
  });
  const edges:Edge[]=relations.map((edge,index)=>{
   const field=edge.sourceHandle.replace('field:','');
   const selected=activePath?pathEdges.has(edge.id):selectedEdgeId?edge.id===selectedEdgeId:activeField?activeField===field:activeType?edge.source===activeType||edge.target===activeType:false;
   const hovered=!activePath&&hoveredField===field;
   const dimmed=!hovered&&(hasSelection?!selected:Boolean(hoveredField));
   const stroke=selected||hovered?'var(--graph-edge-active)':edge.covered?'var(--graph-edge-covered)':'var(--graph-edge-muted)';
   return {id:edge.id,source:edge.source,target:edge.target,sourceHandle:edge.sourceHandle,targetHandle:'target:'+edge.id,ariaLabel:edge.covered===undefined?undefined:`${field} → ${edge.target}: ${edge.covered?'Покрыто':'Не покрыто'}`,type:'routed',className:dimmed?'schema-edge-dimmed':undefined,focusable:!dimmed,selectable:!dimmed,data:{offset:(index%4)*6,obstacles:boxes.filter(box=>box.id!==edge.source&&box.id!==edge.target)},markerEnd:{type:MarkerType.ArrowClosed,width:12,height:12,color:stroke},style:{stroke,strokeWidth:selected||hovered?2.4:1.25,opacity:dimmed?.14:1}};
  });
  return {nodes,edges};
 },[graphTypes,detail,hoveredField,nodePositions,nodeMeasurements,schemaId,schemaHistory,activePath]);
 const focusExplorer=(typeName:string,fieldName?:string,edgeId?:string)=>{if(fieldName)openField(typeName,fieldName);else openType(typeName,edgeId);setMode('graph')};
 const clearSchemaSelection=()=>{setDetail(null);setHoveredField(null)};
 const viewKey=`backend:${graphScope}:${schemaId??'none'}`;
 const savedViewport=useRef<{key:string;viewport:Viewport}>(null);
 const showTable=()=>{
  if(mode==='graph')savedViewport.current={key:viewKey,viewport:flow.getViewport()};
  setMode('table');
 };
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
 const testAnalytics=apiRun&&page==='tests'&&<BackendTests key={JSON.stringify([serviceScope,schemaId,apiRun.id])} scope={`${serviceScope}:${schemaId}:${apiRun.status}`} runId={apiRun.id} revision={analysisRevision} role={session?.user.role} selectedId={selectedTestId} onSelect={id=>setSelectedTest(testContext&&id?{...testContext,value:id}:null)} onRequests={showTestRequests} onField={(type,field)=>{setPage('schema');focusExplorer(type,field)}} view={activeTestView} onView={value=>setTestListView(testContext?{...testContext,value}:null)}/>;
 const realAnalytics=apiRun&&(page==='operations'||page==='requests')&&(()=>{
  const Analytics=page==='operations'?BackendOperations:BackendRequests;
  return <Analytics key={JSON.stringify([analysisScope,page,backendNavigation])} scope={analysisScope!} revision={analysisRevision}
   testExecutionId={page==='requests'?journalTestId:undefined} onTest={openTests} onClearTest={()=>setTestJournal(null)} snapshotId={schemaId??undefined} requestPath={page==='requests'?activeRequestPath:undefined} onClearPath={()=>setRequestPath(null)} runId={apiRun.id} role={session?.user.role} field={page==='operations'?operationField:requestField}
   operationKey={page==='operations'?backendOperationKey:requestOperation} filter={requestFilter} sort={sort} types={graphTypes} stats={stats.data}
   onField={(type,field)=>{setPage('schema');focusExplorer(type,field)}}
   onRequests={key=>goRequests('all','',key)} onOperation={key=>{goOperations('');setBackendOperationKey(key)}}
   onClearContext={()=>{if(page==='operations')setOperationField('');else {setTestJournal(null);setRequestPath(null);setRequestField('');setRequestOperation('')}}}
   />;
 })();
 return <ExportWorkspace key={JSON.stringify([serviceScope,serviceId,schemaId,apiRun?.id])}><div className="analytics-app"><TopChrome runLoading={autoRun.loading} exportControl={<ExportCenter runId={apiRun?.id} snapshotId={schemaId??undefined} serviceId={serviceId} role={session?.user.role} csrfToken={session?.csrfToken} comparisonMode={comparisonOpen} testFilters={activeTestView.query}/>} onGitlab={submitGitlabRun} gitlabManaged={Boolean(gitlab.data)||Boolean(pendingGitlab&&pendingGitlab.runId===trackedRunId)} gitlabChecking={gitlab.loading} showSummary={!comparisonOpen&&page!=='tests'} adminOpen={adminOpen} onAdmin={()=>setAdminRevision(auth.revision)} canFinish={canFinishRun&&gitlab.canFinish} coverageRefreshing={runCoverage.loading} contextRefreshing={!apiRun&&(remote.graph.refreshing||remote.snapshots.refreshing)} intent={intent} onAction={requestAction} onCloseAction={closeAction} auth={auth} catalog={catalog} serviceId={serviceId} snapshots={snapshots} snapshot={selectedSnapshot} snapshotStatus={snapshotStatus} apiRun={apiRun} onCreateRun={submitApiRun} onFinishRun={()=>{if(gitlab.canFinish&&apiRun?.status==='running')setFinishRequest({scope:serviceScope,run:apiRun})}} backendStats={stats.data} statsLoading={stats.loading} summaryErrors={summaryErrors} onRefresh={refreshContext} onRefreshSummary={refreshRunAnalytics} coverage={coverageSummary} schemaFieldCount={coverageSummary?.totalFields??snapshotGraph?.summary.totalFields??null} page={page} onService={chooseService} onCreateService={submitService} onEditService={submitServiceEdit} onSnapshot={chooseSnapshot} onImport={importSnapshot} onRenameSnapshot={submitSnapshotName} snapshotDisplayName={remote.selected?.displayName} onPage={next=>{setComparisonOpen(false);if(next==='operations'){goOperations('');return}if(next==='requests'){goRequests();return}if(next==='tests'){openTests();return}setPage(next);setQuery('');setDetail(null);setSort('date')}} onMetric={summaryAction}/>{autoRun.error&&<div className="content-panel" role="alert">Не удалось выбрать прогон: {analyticsError(autoRun.error)} <button type="button" onClick={autoRun.retry}>Повторить выбор прогона</button></div>}{message?<div className="toast" role="status">{message}<button onClick={()=>setMessage('')}>×</button></div>:showGitlabNotice&&
  <div className="toast">
   <span role={gitlab.error?'alert':'status'}>{gitlabNotices}</span>
   {gitlab.error&&<button type="button" onClick={gitlab.retry}>Повторить чтение статуса</button>}
   <button type="button" aria-label="Закрыть уведомление GitLab" onClick={()=>setDismissedGitlabNotice(gitlabNoticeKey)}>×</button>
  </div>}
 {adminOpen?<AdminUsers key={auth.revision} auth={auth} services={catalog.services.filter(service=>service.source==='backend')} onClose={()=>setAdminRevision(null)}/>:<main className={`analytics-main page-${comparisonOpen?'comparison':page}`} aria-labelledby={comparisonOpen?undefined:`analytics-section-${page}`} aria-label={comparisonOpen?'Сравнение прогонов':undefined}>{page==='history'&&!comparisonOpen&&<div className="view-heading"><h1 id="analytics-section-history">История прогонов</h1></div>}<div className="view-body">{comparisonOpen&&remoteService?<RunComparison key={JSON.stringify([serviceScope,schemaId])} snapshots={snapshots} initialSnapshotId={schemaId} session={session} initialFilters={comparisonSeed?.scope===serviceScope&&comparisonSeed.serviceId===serviceId?comparisonSeed:undefined} onBack={()=>setComparisonOpen(false)}/>:page==='history'&&remoteService
  ?<BackendRunHistory key={`${serviceScope}:${historyVersion}`} serviceId={remoteService.id} snapshots={snapshots}
    scope={serviceScope} signedIn={Boolean(session)} snapshotsReady={remoteList.kind!=='loading'} selectedId={apiRun?.id} onSelect={chooseApiRun} onCompare={context=>{setComparisonSeed({...context,scope:serviceScope,serviceId});setComparisonOpen(true)}}/>
  :testAnalytics?testAnalytics:realAnalytics?realAnalytics:(page!=='schema'||!remoteGraphData)?<div className="content-panel">
  {page==='history'?<Empty text={catalog.state.kind==='error'?catalog.state.error.message:catalog.state.kind==='loading'?'Загружаем сервисы API…':'Нет доступных сервисов API.'}/>:
   page!=='schema'?<Empty text="Выберите прогон в истории, чтобы открыть аналитику."/>:
   <div className="empty-state" role={runCoverage.error||schemaError&&!runCoverage.loading?'alert':'status'}>
    <p>{!remoteService&&catalog.state.kind==='error'?catalog.state.error.message:!remoteService?(catalog.state.kind==='loading'?'Загружаем сервисы API…':'Нет доступных сервисов API. Добавьте сервис, чтобы начать работу.'):remoteMessage}</p>
    {schemaError&&!runCoverage.loading&&<button type="button" onClick={remoteList.kind==='error'?remote.snapshots.retry:remote.graph.retry}>Повторить</button>}
   </div>}
 </div>:page==='schema'?<><SchemaExplorer key={viewKey} types={graphTypes} coverageAvailable={coverageAvailable} emptyMessage="В графе снимка нет типов." coverageRequest={explorerRequest} selectedType={detail?.kind==='type'?detail.id:detail?.kind==='field'?detail.id.split('.')[0]:null} selectedField={detail?.kind==='field'?detail.id:null} onType={name=>focusExplorer(name)} onField={(type,field)=>focusExplorer(type,field)}/><div className="content-panel">
  <div className="panel-tools schema-panel-tools">
   <span>{graphTypes.length} типов · {graph.edges.length} связей</span>
   <div className="schema-view-actions">
    {detail&&<button type="button" className="schema-clear-selection" onClick={clearSchemaSelection}>Сбросить выделение</button>}
    <div className="segmented" role="group" aria-label="Режим просмотра схемы">
     <button className={mode==='graph'?'active':''} aria-pressed={mode==='graph'} onClick={()=>setMode('graph')}>Граф</button>
     <button className={mode==='table'?'active':''} aria-pressed={mode==='table'} onClick={showTable}>Таблица</button>
    </div>
   </div>
  </div>
 {mode==='graph'?<><div className="flow-space">{!schemaId&&<div className="schema-empty-hint">Схем пока нет. Добавьте снимок через селектор в верхней панели.</div>}{!graphTypes.length&&<div className="schema-empty-hint">В графе снимка нет типов.</div>}<ReactFlow key={viewKey} defaultViewport={savedViewport.current?.key===viewKey?savedViewport.current.viewport:undefined} nodes={graph.nodes} onNodesChange={onNodesChange} edges={graph.edges} onEdgeMouseEnter={(_,edge)=>setHoveredField(edge.sourceHandle?.replace(/^field:/,'')??null)} onEdgeMouseLeave={()=>setHoveredField(null)} onEdgeClick={(_,edge)=>{const field=edge.sourceHandle?.replace(/^field:/,'');if(!field)return;const dot=field.indexOf('.');if(dot>=0)openField(field.slice(0,dot),field.slice(dot+1))}} nodeTypes={{type:TypeNode}} edgeTypes={{routed:RoutedEdge}} nodesConnectable={false}><Background gap={18} color="var(--graph-dot)"/><GraphControls hasNodes={graph.nodes.length>0}/></ReactFlow></div></>:<SchemaCoverageTable
  key={viewKey}
  types={graphTypes}
  coverageAvailable={coverageAvailable}
  query={query}
  filter={fieldFilter}
  sort={sort}
  selectedType={detail?.kind === 'type' ? detail.id : null}
  selectedField={detail?.kind === 'field' ? detail.id : null}
  onQuery={setQuery}
  onFilter={setFieldFilter}
  onSort={setSort}
  onField={openField}
 /> }</div></>:null}{page==='schema'&&(detail?.kind==='type'||detail?.kind==='field')&&<SchemaDetailPanel onHighlightPath={highlightPath} testRevision={analysisRevision} onTest={openTests} runId={apiRun?.id} snapshotId={schemaId} resourceScope={serviceScope} onFindPath={findRequestsForPath} showAnalyticsLinks={Boolean(apiRun)} canOpenRequests={mayReadJournal(session?.user.role)} types={graphTypes} snapshot={detailSnapshot} sdlMessage={sdlMessage} history={schemaHistory} onBack={()=>travelSchema(-1)} onForward={()=>travelSchema(1)} onClose={clearSchemaSelection} onTab={changeSchemaTab} onType={(name,edgeId)=>focusExplorer(name,undefined,edgeId)} onField={(type,field)=>focusExplorer(type,field)} onOperations={goOperations} onRequests={field=>goRequests('all',field)}/>}</div></main>}{finishTarget&&<FinishRunDialog key={finishTarget.id} run={finishTarget} onFinish={completeApiRun} onClose={()=>setFinishRequest(null)}/>}</div></ExportWorkspace>}
function Empty({text}:{text:string}){return <div className="empty-state">{text}</div>}
function AuthenticatedWorkspace(){
 const auth=useAuth();
 if(!auth.checked)return <div className="empty-state" role="status">Восстанавливаем сессию…</div>;
 if(!auth.session&&auth.error)return <div className="empty-state" role="alert">Не удалось восстановить сессию. <button onClick={()=>void auth.restore()}>Повторить</button></div>;
 const owner=workspaceOwner(auth.session?.user.id);
 return <Inner key={owner} auth={auth} owner={owner}/>;
}
export default function AnalyticsApp(){return <ReactFlowProvider><AuthenticatedWorkspace/></ReactFlowProvider>}

