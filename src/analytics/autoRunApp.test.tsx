// @vitest-environment jsdom
import {act,type ComponentProps} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import AnalyticsApp from './AnalyticsApp';
import type {TopChrome} from './TopChrome';
import {useAuth} from './useAuth';
import {useGitlabPipeline} from './useGitlabPipeline';
import {listServices} from '../api/services';
import {getSchemaGraph,listSchemas} from '../api/schemas';
import {createRun,findRun,listRuns,type RunOut} from '../api/runs';
import {readRunPreference,rememberRun,workspaceOwner} from './workspaceSelection';
vi.mock('./useAuth',()=>({useAuth:vi.fn()}));
vi.mock('../api/services',async original=>({...await original<object>(),listServices:vi.fn()}));
vi.mock('../api/schemas',async original=>({...await original<object>(),listSchemas:vi.fn(),getSchemaGraph:vi.fn()}));
vi.mock('../api/runs',async original=>({...await original<object>(),listRuns:vi.fn(),findRun:vi.fn(),createRun:vi.fn()}));
vi.mock('./useRunAnalytics',async original=>({...await original<object>(),useRunAnalytics:vi.fn(()=>({coverage:{loading:false,error:null,data:null},stats:{loading:false},scope:null,revision:0,refresh:()=>false}))}));
vi.mock('./useGitlabPipeline',()=>({useGitlabPipeline:vi.fn()}));
vi.mock('./TopChrome',()=>({TopChrome:(props:ComponentProps<typeof TopChrome>)=>{chrome=props;return null}}));
vi.mock('./BackendRunHistory',()=>({BackendRunHistory:({onSelect}:{onSelect:(run:RunOut)=>void})=><button onClick={()=>onSelect(manual)}>Select manual</button>}));
const id=(n:number)=>`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
const A=id(1),B=id(2),old=id(3),latest=id(4),user=id(5),owner=workspaceOwner(user);
const date='2026-11-18T12:00:00Z';
const run=(n:number,snapshotId=old):RunOut=>({id:id(n),snapshotId,name:`Run ${n}`,status:'completed',startedAt:date,finishedAt:date});
const manual=run(10,latest);
let chrome:ComponentProps<typeof TopChrome>,root:Root,container:HTMLDivElement,auth:ReturnType<typeof useAuth>;
const authFor=(userId:string|null,revision=1):ReturnType<typeof useAuth>=>({checked:true,pending:null,error:null,revision,session:userId?{user:{id:userId,username:userId,role:'operator',isActive:true},csrfToken:'secret-test-token',expiresAt:'2099-01-01T00:00:00Z'}:null,getCurrent:()=>auth,restore:vi.fn(),signIn:vi.fn(),signOut:vi.fn()});
async function render(){await act(async()=>root.render(<AnalyticsApp/>))}
beforeEach(()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);localStorage.clear();vi.clearAllMocks();
 container=document.createElement('div');document.body.append(container);root=createRoot(container);auth=authFor(user);vi.mocked(useAuth).mockImplementation(()=>auth);
 vi.mocked(useGitlabPipeline).mockReturnValue({data:undefined,error:undefined,loading:false,canFinish:true,retry:()=>{}});
 vi.mocked(listServices).mockResolvedValue([A,B].map(id=>({id,key:id,name:id,isPublic:false,createdAt:date,updatedAt:date,endpointUrl:'https://example.test'})));
 vi.mocked(listSchemas).mockImplementation(async serviceId=>[latest,old].map(id=>({id,serviceId,schemaHash:id,source:'sdl',createdAt:id===latest?'2026-11-19T00:00:00Z':date})));
 vi.mocked(getSchemaGraph).mockImplementation(()=>new Promise(()=>{}));
 vi.mocked(listRuns).mockResolvedValue({runs:[],hasMore:false});vi.mocked(findRun).mockImplementation(async(_snapshot,id)=>run(Number(id.slice(-2))));
});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();vi.unstubAllGlobals()});
it('keeps schema selection across views and clears it from the toolbar or details',async()=>{
 vi.stubGlobal('ResizeObserver',class{observe(){} unobserve(){} disconnect(){}});
 vi.stubGlobal('requestAnimationFrame',()=>0);
 const field=(name:string,returnType='Int')=>({name,returnType,targetType:returnType==='ShopStats'?returnType:null,deprecated:false,covered:false,hits:0});
 const type=(name:string,fields:ReturnType<typeof field>[])=>({name,kind:'OBJECT',fields,totalFields:fields.length,coveredFields:0,coveragePercent:0});
 vi.mocked(getSchemaGraph).mockResolvedValue({
  schemaId:latest,runId:null,rootTypes:{query:'Query',mutation:'Mutation'},relations:[],
  summary:{totalFields:6,coveredFields:0,coveragePercent:0},
  types:[
   type('Query',[field('adminStats','ShopStats'),field('viewer')]),
   type('Mutation',[field('refreshStats','ShopStats')]),
   type('ShopStats',[field('activeOrders'),field('customers'),field('revenueCents')]),
  ],
 });
 const button=(selector:string,text:string)=>Array.from(container.querySelectorAll<HTMLButtonElement>(selector)).find(el=>el.textContent?.trim()===text);
 const click=async(el:HTMLElement|undefined|null)=>{
  expect(el).toBeTruthy();
  await act(async()=>el!.click());
 };
 const toggle=(mode:'Граф'|'Таблица')=>click(button('.schema-view-actions button',mode));
 const select=(type:string)=>click(Array.from(container.querySelectorAll<HTMLButtonElement>('.explorer-type')).find(el=>el.querySelector('strong')?.textContent===type));
 const clear=()=>container.querySelector<HTMLButtonElement>('.schema-view-actions .schema-clear-selection');
 const detail=()=>container.querySelector('.schema-detail-panel');
 const selected=(className:string)=>Array.from(container.querySelectorAll<HTMLTableRowElement>(`tbody tr.${className}`),row=>`${row.cells[0].textContent}.${row.cells[1].textContent}`);
 await render();
 expect(clear()).toBeNull();
 expect(container.querySelector('[aria-label="Вписать граф"]')).toBeTruthy();
 await select('Query');
 expect(clear()).toBeTruthy();
 expect(detail()?.querySelector('h2')?.textContent).toBe('Query');
 expect(container.querySelector('.explorer-actions')).toBeNull();
 expect(container.textContent).not.toContain('Общий обзор');
 await toggle('Таблица');
 expect(selected('selected-type')).toEqual(['Query.adminStats','Query.viewer']);
 await toggle('Граф');
 await toggle('Таблица');
 expect(selected('selected-type')).toEqual(['Query.adminStats','Query.viewer']);
 await select('Mutation');
 await toggle('Таблица');
 expect(selected('selected-type')).toEqual(['Mutation.refreshStats']);
 await select('ShopStats');
 await toggle('Таблица');
 expect(selected('selected-type')).toEqual(['ShopStats.activeOrders','ShopStats.customers','ShopStats.revenueCents']);
 await click(button('.schema-table-field','adminStats'));
 expect(selected('selected-type')).toEqual([]);
 expect(selected('selected')).toEqual(['Query.adminStats']);
 expect(detail()?.querySelector('h2')?.textContent).toBe('Query.adminStats');
 await click(clear());
 expect(selected('selected')).toEqual([]);
 expect(clear()).toBeNull();
 expect(detail()).toBeNull();
 expect(button('.schema-view-actions button','Таблица')?.getAttribute('aria-pressed')).toBe('true');
 await select('ShopStats');
 await click(clear());
 expect(clear()).toBeNull();
 expect(detail()).toBeNull();
 expect(button('.schema-view-actions button','Граф')?.getAttribute('aria-pressed')).toBe('true');
 await select('ShopStats');
 await toggle('Таблица');
 await click(container.querySelector<HTMLButtonElement>('[aria-label="Закрыть подробности"]'));
 expect(selected('selected-type')).toEqual([]);
 expect(clear()).toBeNull();
 expect(detail()).toBeNull();
});
it('keeps GitLab warnings dismissible and retryable without a pipeline panel for active or completed runs',async()=>{
 const completed=run(20);
 const active:RunOut={...completed,id:id(21),status:'running',finishedAt:null};
 const retry=vi.fn();
 vi.mocked(listRuns).mockResolvedValue({runs:[active],hasMore:false});
 vi.mocked(useGitlabPipeline).mockImplementation(runId=>({
  data:runId?{runId,pipelineId:12,pipelineUrl:null,pipelineStatus:runId===active.id?'running':'failed',
   runStatus:runId===active.id?'running':'completed',errorCode:runId===completed.id?'tracking_deadline_exceeded':null,
   createdAt:date,finishedAt:runId===active.id?null:date,trackingFinished:runId===completed.id,collectionIncomplete:runId===completed.id}:undefined,
  error:runId===active.id?new Error('Ошибка чтения GitLab'):undefined,loading:false,canFinish:!runId,retry,
 }));
 await render();
 expect(chrome.apiRun?.status).toBe('running');
 expect(chrome.canFinish).toBe(false);
 expect(container.querySelector('[aria-label="GitLab CI"]')).toBeNull();
 expect(container.querySelector('.toast [role="alert"]')?.textContent).toContain('Ошибка чтения GitLab');
 await act(async()=>container.querySelector<HTMLButtonElement>('.toast button')!.click());
 expect(retry).toHaveBeenCalledOnce();
 await act(async()=>container.querySelector<HTMLButtonElement>('[aria-label="Закрыть уведомление GitLab"]')!.click());
 expect(container.querySelector('.toast')).toBeNull();
 await act(async()=>chrome.onPage('history'));
 // Change the service so the completed run is resolved through the normal selection flow.
 rememberRun(owner,B,{runId:completed.id,snapshotId:old});
 await act(async()=>chrome.onService(B));
 expect(chrome.apiRun?.status).toBe('completed');
 expect(container.querySelector('[aria-label="GitLab CI"]')).toBeNull();
 expect(container.querySelector('.toast')?.textContent).toContain('Неполный сбор');
});
it('restores independent preferences A → B → A and switches snapshot with the run',async()=>{
 rememberRun(owner,A,{runId:id(20),snapshotId:old});rememberRun(owner,B,{runId:id(21),snapshotId:old});
 await render();expect(chrome.apiRun?.id).toBe(id(21));expect(chrome.snapshot?.id).toBe(old);
 await act(async()=>chrome.onService(A));expect(chrome.apiRun?.id).toBe(id(20));expect(chrome.snapshot?.id).toBe(old);
 await act(async()=>chrome.onService(B));expect(chrome.apiRun?.id).toBe(id(21));
 await act(async()=>chrome.onService(A));expect(chrome.apiRun?.id).toBe(id(20));expect(listRuns).not.toHaveBeenCalled();
});
it('remembers manual history selection and restores it on remount',async()=>{
 await render();await act(async()=>chrome.onPage('history'));await act(async()=>container.querySelector('button')!.click());
 expect(chrome.apiRun?.id).toBe(manual.id);expect(readRunPreference(owner,A)).toEqual({runId:manual.id,snapshotId:latest});
 await act(async()=>root.unmount());root=createRoot(container);vi.mocked(findRun).mockResolvedValueOnce(manual);await render();
 expect(chrome.apiRun?.id).toBe(manual.id);expect(chrome.snapshot?.id).toBe(latest);
});
it('counts a newly created run as explicit and stores no session secrets',async()=>{
 await render();await act(async()=>chrome.onAction('run'));vi.mocked(createRun).mockResolvedValueOnce(manual);
 await act(async()=>{await chrome.onCreateRun('New run')});expect(readRunPreference(owner,A)).toEqual({runId:manual.id,snapshotId:latest});expect(JSON.stringify(localStorage)).not.toContain('secret-test-token');
});
it('remounts the workspace on account switch and logout without restoring another owner',async()=>{
 rememberRun(owner,A,{runId:id(20),snapshotId:old});await render();expect(chrome.apiRun?.id).toBe(id(20));
 auth=authFor(id(6),2);await render();expect(chrome.apiRun).toBeNull();expect(chrome.snapshot?.id).toBe(latest);
 auth=authFor(null,3);await render();expect(chrome.apiRun).toBeNull();
 auth=authFor(user,4);await render();expect(chrome.apiRun?.id).toBe(id(20));
});
