// @vitest-environment jsdom
import {act,createElement} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,it,expect,vi} from 'vitest';
import {SchemaDetailPanel} from './SchemaDetailPanel';
import {currentStep,emptyHistory,moveStep,needsSchemaDetailSdl,pushStep,updateStep,type InvestigationHistory} from './schemaInvestigation';
import {useBackendSdl} from './useBackendSchema';
import {getSchemaSdl} from '../api/schemas';
import {getArgumentUsage,type ArgumentUsagePage} from '../api/argumentUsage';
import {argument,argumentPage} from '../testSupport/argumentUsage';
import {evidenceRun,evidenceSnapshot} from '../testSupport/fieldEvidence';
import {snapshotFromSDL} from '../testSupport/sdl';
import type {GraphType} from '../model';
import {ApiError} from '../api/client';
vi.mock('../api/argumentUsage',async original=>({...await original<object>(),getArgumentUsage:vi.fn()}));
vi.mock('../api/schemas',async original=>({...await original<object>(),getSchemaSdl:vi.fn()}));
const sdl='schema { query: ReadRoot mutation: WriteRoot } directive @flag on FIELD_DEFINITION type ReadRoot { adminStats: Int products(limit: Int = 10, category: String): [Product!]! @flag } type WriteRoot { createOrder(id: ID!): Product } type Product { price: Float }';
const snapshot=snapshotFromSDL(sdl,'service','schema','snapshot');
const types:GraphType[]=snapshot.types.map(type=>({...type,fields:type.fields.map(field=>({...field,args:field.name==='products'?[{name:'limit',type:'Int'},{name:'category',type:'String'}]:field.name==='createOrder'?[{name:'id',type:'ID!'}]:[]}))}));
const load=vi.mocked(getArgumentUsage),loadSdl=vi.mocked(getSchemaSdl);
let root:Root,container:HTMLDivElement,history:InvestigationHistory,runId:string|null,snapshotId:string,scope:string;
const noop=()=>{};
function renderPanel(){root.render(createElement(Harness))}
function Harness(){const remote=useBackendSdl(needsSchemaDetailSdl(currentStep(history),types)?snapshotId:null,scope);return createElement(SchemaDetailPanel,{types,history,runId,snapshotId,resourceScope:scope,canOpenRequests:true,snapshot:remote.state.kind==='ready'?{sdl:remote.state.data}:null,sdlMessage:remote.state.kind==='loading'?'Загружаем SDL…':remote.state.kind==='error'?remote.state.error.message:undefined,onTab:tab=>{history=updateStep(history,{tab});renderPanel()},onBack:()=>{history=moveStep(history,-1);renderPanel()},onForward:()=>{history=moveStep(history,1);renderPanel()},onClose:noop,onType:noop,onField:noop,onOperations:noop,onRequests:noop})}
async function select(id:string){await act(async()=>{history=pushStep(history,{kind:'field',id,tab:'Обзор',edgeId:null,viewport:{x:0,y:0,zoom:1}});renderPanel()})}
function button(label:string){return [...container.querySelectorAll('button')].find(el=>el.textContent===label)!}
async function click(label:string){await act(async()=>button(label).click())}
async function expand(){await act(async()=>{const el=container.querySelector<HTMLDetailsElement>('.field-argument-usage')!;el.open=true;el.dispatchEvent(new Event('toggle'))})}
function deferred<T>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(done=>{resolve=done});return {promise,resolve}}
beforeEach(()=>{vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);container=document.createElement('div');document.body.append(container);root=createRoot(container);history=emptyHistory;runId=evidenceRun;snapshotId=evidenceSnapshot;scope='service/session';load.mockReset();loadSdl.mockReset();loadSdl.mockResolvedValue(sdl);load.mockImplementation(async(run,snapshot,type,field)=>argumentPage({runId:run,snapshotId:snapshot,items:[argument({typeName:type,fieldName:field})]}))});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();vi.unstubAllGlobals();vi.restoreAllMocks()});

it('adds only Overview and SDL to custom query/mutation root fields, and arguments only when declared',async()=>{
 await select('ReadRoot.adminStats');expect([...container.querySelectorAll('[role=tab]')].map(el=>el.textContent)).toEqual(['Обзор','SDL']);expect(container.querySelector('.field-argument-usage')).toBeNull();await click('SDL');expect(container.querySelector('pre')?.textContent).toContain('adminStats: Int');expect(container.querySelector('pre')?.textContent).not.toContain('products');
 for(const id of ['ReadRoot.products','WriteRoot.createOrder']){await select(id);expect(container.querySelectorAll('.field-argument-usage')).toHaveLength(1);expect(container.querySelectorAll('.field-response-evidence')).toHaveLength(1);expect(container.querySelectorAll('[role=tab]')).toHaveLength(2)}
 await select('Product.price');expect(container.querySelectorAll('[role=tab]')).toHaveLength(0);expect(container.querySelector('.field-argument-usage')).toBeNull();expect(container.querySelectorAll('.field-response-evidence')).toHaveLength(1);expect(load).not.toHaveBeenCalled();
});
it('loads current snapshot SDL lazily and preserves the selected declaration and existing CodeView controls',async()=>{
 await select('ReadRoot.products');expect(loadSdl).not.toHaveBeenCalled();await click('SDL');expect(loadSdl.mock.calls[0][0]).toBe(snapshotId);const code=container.querySelector('pre')?.textContent;expect(code).toContain('limit: Int = 10');expect(code).toContain('category: String');expect(code).toContain('[Product!]!');expect(code).toContain('@flag');expect(code).not.toContain('adminStats');expect(button('Копировать')).toBeDefined();expect(button('Развернуть')).toBeDefined();
 await click('Обзор');expect(container.querySelector('.field-response-evidence')).not.toBeNull();expect(container.querySelector('pre')).toBeNull();await select('WriteRoot.createOrder');await click('SDL');expect(container.querySelector('pre')?.textContent).toContain('createOrder(id: ID!)');expect(container.querySelector('pre')?.textContent).not.toContain('products');
});
it('retains history tabs and never accumulates Evidence, Argument Usage or path disclosures',async()=>{
 const errors=vi.spyOn(console,'error').mockImplementation(()=>{});
 for(let repeat=0;repeat<3;repeat++)for(const id of ['ReadRoot.products','WriteRoot.createOrder','Product.price','ReadRoot.adminStats']){await select(id);expect(container.querySelectorAll('.field-response-evidence')).toHaveLength(1);expect(container.querySelectorAll('.field-request-paths')).toHaveLength(1);expect(container.querySelectorAll('.field-argument-usage')).toHaveLength(id.includes('products')||id.includes('createOrder')?1:0)}
 await click('SDL');await click('← Назад');expect(container.querySelector('h2')?.textContent).toBe('Product.price');expect(container.querySelector('[role=tablist]')).toBeNull();await click('Вперёд →');expect(container.querySelector('h2')?.textContent).toBe('ReadRoot.adminStats');expect(container.querySelector('pre')?.textContent).toContain('adminStats');expect(errors.mock.calls.flat().join(' ')).not.toMatch(/same key|unique.*key/);
});
it('renders five independent counts, defaults presence and a run-wide partial warning without values',async()=>{
 load.mockResolvedValueOnce(argumentPage({items:[{...argument({typeName:'ReadRoot'}),variableValue:'SECRET',defaultValue:'SECRET'} as never]}));await select('ReadRoot.products');expect(load).not.toHaveBeenCalled();await expand();expect(load.mock.calls[0].slice(0,5)).toEqual([runId,snapshotId,'ReadRoot','products',0]);const text=container.textContent!;for(const label of ['Передан ненулевой','Явно null','Не передан','Неизвестно','Смешанное использование','Всего обращений','Значение по умолчанию в схеме: есть','для 1 обращений'])expect(text).toContain(label);expect(container.querySelector('.argument-usage-row dl')?.textContent).toBe('Передан ненулевой2Явно null1Не передан2Неизвестно1Смешанное использование1Всего обращений7');expect(text).not.toContain('SECRET');
});
it.each(['available','unavailable'] as const)('renders availability %s without inventing usage for missing data',async availability=>{
 load.mockResolvedValueOnce(argumentPage({availability,totalRequests:7,analyzedRequests:availability==='available'?7:0,unavailableRequests:availability==='available'?0:7,items:[argument({typeName:'ReadRoot',providedCount:0,explicitNullCount:0,omittedCount:0,unknownCount:0,mixedCount:0,requestCount:0})]}));await select('ReadRoot.products');await expand();if(availability==='unavailable'){expect(container.textContent).toContain('Аналитика аргументов недоступна');expect(container.querySelector('.argument-usage-row')).toBeNull()}else{expect(container.querySelector('.argument-usage-row')).not.toBeNull();expect(container.textContent).toContain('нет учтённых обращений')}
});
it('paginates more than 200 arguments in the existing disclosure',async()=>{
 load.mockImplementation(async(run,snapshot,type,field,offset=0)=>argumentPage({runId:run,snapshotId:snapshot,offset,total:201,items:Array.from({length:offset===200?1:100},(_,i)=>argument({typeName:type,fieldName:field,argumentName:`arg${offset+i}`}))}));await select('ReadRoot.products');await expand();expect(container.querySelectorAll('.argument-usage-row')).toHaveLength(100);
 for(const [offset,length] of [[100,200],[200,201]]){const next=[...container.querySelectorAll('button')].find(el=>el.textContent?.startsWith('Загрузить ещё аргументы'))!;await act(async()=>next.click());expect(load.mock.calls.at(-1)?.[4]).toBe(offset);expect(container.querySelectorAll('.argument-usage-row')).toHaveLength(length)}expect(container.querySelectorAll('.field-argument-usage')).toHaveLength(1);
});
it('cancels pending argument requests during field selection and prevents stale results replacing the current field',async()=>{
 const old=deferred<ArgumentUsagePage>();load.mockReturnValueOnce(old.promise);await select('ReadRoot.products');await expand();const signal=load.mock.calls[0][5]!;await select('WriteRoot.createOrder');expect(signal.aborted).toBe(true);expect(container.querySelector('.argument-usage-row')).toBeNull();await expand();expect(load.mock.calls.at(-1)?.[3]).toBe('createOrder');await act(async()=>old.resolve(argumentPage({items:[argument({argumentName:'STALE'})]})));expect(container.textContent).not.toContain('STALE');expect(container.querySelectorAll('.field-argument-usage')).toHaveLength(1);
});
it.each(['run','snapshot','service'] as const)('resets argument statistics and cancels pending reads on %s changes',async context=>{
 const old=deferred<ArgumentUsagePage>();load.mockReturnValueOnce(old.promise);await select('ReadRoot.products');await expand();const signal=load.mock.calls[0][5]!;await act(async()=>{if(context==='run')runId=evidenceSnapshot;else if(context==='snapshot')snapshotId=evidenceRun;else scope='other-service';renderPanel()});expect(signal.aborted).toBe(true);expect(container.querySelector('.field-argument-usage')?.hasAttribute('open')).toBe(false);await expand();expect(load.mock.calls.at(-1)?.slice(0,2)).toEqual([runId,snapshotId]);await act(async()=>old.resolve(argumentPage({items:[argument({argumentName:'STALE'})]})));expect(container.textContent).not.toContain('STALE');
});
it('does not call protected analytics without a selected run',async()=>{runId=null;await select('ReadRoot.products');await expand();expect(container.textContent).toContain('Выберите прогон');expect(load).not.toHaveBeenCalled()});
it.each([401,403,404,422])('shows argument analytics HTTP %s as an error rather than zero counts',async status=>{load.mockRejectedValueOnce(new ApiError('http','request failed',status));await select('ReadRoot.products');await expand();expect(container.querySelector('[role=alert]')?.textContent).toMatch(/Войдите|Недостаточно прав|не найдены|Некорректные параметры/);expect(container.querySelector('.argument-usage-row')).toBeNull();expect(button('Повторить загрузку аргументов')).toBeDefined()});
it('shows SDL loading/error and ignores a late old-snapshot declaration',async()=>{
 const old=deferred<string>();loadSdl.mockReturnValueOnce(old.promise);await select('ReadRoot.products');await click('SDL');expect(container.textContent).toContain('Загружаем SDL');const signal=loadSdl.mock.calls[0][1]!;loadSdl.mockResolvedValueOnce(sdl);await act(async()=>{snapshotId=evidenceRun;renderPanel()});expect(signal.aborted).toBe(true);await act(async()=>old.resolve('type ReadRoot { OLD: Int }'));expect(container.querySelector('pre')?.textContent).toContain('products');expect(container.textContent).not.toContain('OLD');
 loadSdl.mockRejectedValueOnce(new Error('SDL read failed'));await act(async()=>{snapshotId='next';renderPanel()});expect(container.textContent).toContain('SDL read failed');expect(container.querySelector('pre')).toBeNull();
});
