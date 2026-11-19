// @vitest-environment jsdom
import {act,createElement} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {BackendRequests} from './BackendRunAnalytics';
import {getFilteredJournal,getRequestDetail,type RequestDetail} from '../api/runAnalytics';
import {getEvidencePage} from '../api/fieldEvidence';
import {getExecution} from '../api/testCoverage';
import {requestDetail} from '../testSupport/requestPaths';
import {evidencePage,evidenceField,evidenceRun,evidenceSnapshot} from '../testSupport/fieldEvidence';
import {execution,executionId} from '../testSupport/testCoverage';
import {ApiError} from '../api/client';
vi.mock('../api/runAnalytics',async original=>({...await original<object>(),getFilteredJournal:vi.fn(),getRequestDetail:vi.fn()}));
vi.mock('../api/fieldEvidence',async original=>({...await original<object>(),getEvidencePage:vi.fn()}));
vi.mock('../api/testCoverage',async original=>({...await original<object>(),getExecution:vi.fn()}));
const first:RequestDetail={...requestDetail('first'),runId:evidenceRun,operationName:'FindCustomer',operationType:'query',operationKey:'operation-key',testExecutionId:executionId,httpStatus:200,durationMs:142,graphqlHasErrors:true,graphqlErrorCount:2,graphqlErrorDetailsAvailability:'truncated',graphqlErrorDetails:[{code:'BAD_USER_INPUT',safeMessage:'The GraphQL request contains invalid input.',path:['customer','orders',0,'id'],locations:[{line:3,column:5}]}],selectedFields:[{typeName:'Customer',fieldName:'id',returnType:'ID!'}],documentAvailability:'redacted',safeGraphqlDocument:'query FindCustomer { customer(id: "[REDACTED]") { id } }',errorCode:'LOCAL_CODE'};
const second:RequestDetail={...first,id:'second',operationName:'ListOrders',operationType:'mutation',testExecutionId:null,graphqlHasErrors:false,graphqlErrorCount:0,graphqlErrorDetailsAvailability:'sanitized',graphqlErrorDetails:[],selectedFields:[],safeGraphqlDocument:'mutation ListOrders { updateOrders { id } }',errorCode:null};
const read=vi.mocked(getRequestDetail),evidence=vi.mocked(getEvidencePage);
let root:Root,container:HTMLDivElement,scope:string,runId:string;
const onField=vi.fn(),onTest=vi.fn(),onOperation=vi.fn();
function App(){return <BackendRequests key={`${scope}:${runId}`} runId={runId} snapshotId={evidenceSnapshot} scope={scope} revision={0} role="analyst" field="" operationKey="" filter="all" sort="date" types={[]} onField={onField} onTest={onTest} onOperation={onOperation} onRequests={()=>{}} onClearContext={()=>{}}/>}
async function render(){await act(async()=>root.render(createElement(App)))}
async function click(text:string){await act(async()=>[...container.querySelectorAll('button')].find(button=>button.textContent?.includes(text))!.click())}
function deferred<T>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(done=>{resolve=done});return {promise,resolve}}
beforeEach(()=>{vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);container=document.createElement('div');document.body.append(container);root=createRoot(container);scope='service/session';runId=evidenceRun;onField.mockReset();onTest.mockReset();onOperation.mockReset();vi.mocked(getFilteredJournal).mockReset().mockResolvedValue({rows:[first,second],more:false});read.mockReset().mockImplementation(async(_run,id)=>id==='first'?first:second);evidence.mockReset().mockResolvedValue(evidencePage({fields:[evidenceField({typeName:'Customer',fieldName:'id'})]}));vi.mocked(getExecution).mockReset().mockResolvedValue({...execution(),name:'Checkout E2E',runId:evidenceRun})});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();vi.restoreAllMocks();vi.unstubAllGlobals();vi.useRealTimers()});
it('loads details on selection and keeps metrics above lazy tabs',async()=>{
 await render();expect(read).not.toHaveBeenCalled();expect(evidence).not.toHaveBeenCalled();
 await click('FindCustomer');const panel=container.querySelector<HTMLElement>('[aria-label="Подробности обращения"]')!;
 expect(panel.querySelector('h2')?.textContent).toBe('FindCustomer');expect(panel.querySelector('time')?.dateTime).toBe(first.createdAt);
 expect(panel.querySelector('header')?.textContent).toContain('Query');
 expect(panel.querySelector('.request-quick-facts')?.textContent).toContain('HTTP200GraphQL2 ошибкиВремя');
 expect(panel.querySelector('.request-quick-facts')?.closest('.request-detail-body')).toBeNull();
 expect([...panel.querySelectorAll('[role=tab]')].map(el=>el.textContent)).toEqual(['Обзор','Документ','Поля','Тесты']);
 expect(panel.querySelector('[role=tab][aria-selected=true]')?.textContent).toBe('Обзор');
 expect(panel.querySelector('.graphql-error-details')?.hasAttribute('open')).toBe(true);
 expect(panel.querySelector('.request-document')).toBeNull();expect(panel.querySelector('.request-fields')).toBeNull();expect(panel.querySelector('.request-related-test')).toBeNull();
 expect(evidence).not.toHaveBeenCalled();expect(getExecution).not.toHaveBeenCalled();expect(read).toHaveBeenCalledTimes(1);
});
it('keeps safe document, field navigation, operation navigation and the real E2E attempt',async()=>{
 await render();await click('FindCustomer');const panel=container.querySelector('[aria-label="Подробности обращения"]')!;
 expect(panel.querySelector('.request-extra')?.textContent).toContain('Код локального анализаLOCAL_CODE');
 await click('Открыть операцию');expect(onOperation).toHaveBeenCalledWith('operation-key');
 await click('Документ');expect(panel.querySelector('pre')?.textContent).toContain('[REDACTED]');expect(panel.textContent).toContain('Чувствительные значения скрыты сервером');
 expect(evidence).not.toHaveBeenCalled();expect(getExecution).not.toHaveBeenCalled();
 await click('Поля');expect(evidence).toHaveBeenCalledOnce();expect(evidence.mock.calls[0][2]).toEqual({requestId:'first'});
 await click('Customer.id');expect(onField).toHaveBeenCalledWith('Customer','id');expect(panel.querySelectorAll('.evidence-field-link')).toHaveLength(1);
 expect(getExecution).not.toHaveBeenCalled();
 await click('Тесты');expect(getExecution).toHaveBeenCalledWith(evidenceRun,executionId,expect.any(AbortSignal));
 await click('Checkout E2E');expect(onTest).toHaveBeenCalledWith(executionId);
 expect(panel.querySelectorAll('.object-test-list li')).toHaveLength(1);
});
it('copies only the existing safe document via CodeView',async()=>{
 vi.useFakeTimers();const writeText=vi.fn().mockResolvedValue(undefined);Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText}});
 await render();await click('FindCustomer');await click('Документ');await click('Копировать');
 expect(writeText.mock.calls[0][0]).toContain('[REDACTED]');expect(writeText.mock.calls[0][0]).not.toContain('LOCAL_CODE');
 vi.clearAllTimers();vi.useRealTimers();
});
it('resets to Overview on selection and keeps unknown counts, unavailable documents and absent links distinct',async()=>{
 read.mockResolvedValueOnce(first).mockResolvedValueOnce({...second,operationName:null,safeGraphqlDocument:null,documentAvailability:'unavailable',graphqlErrorCount:null,graphqlErrorDetailsAvailability:'unavailable',graphqlErrorDetails:null});
 await render();await click('FindCustomer');await click('Документ');await click('ListOrders');
 const panel=container.querySelector('[aria-label="Подробности обращения"]')!;
 expect(panel.querySelector('h2')?.textContent).toBe('Безымянная операция');expect(panel.querySelector('[role=tab][aria-selected=true]')?.textContent).toBe('Обзор');
 expect(panel.querySelector('.request-quick-facts')?.textContent).toContain('Неизвестно');expect(panel.textContent).toContain('Число ошибок неизвестно');
 expect(panel.querySelector('.graphql-error-none')).toBeNull();expect(panel.querySelector('.request-extra')?.hasAttribute('open')).toBe(false);
 expect(panel.textContent).not.toContain('BAD_USER_INPUT');expect(panel.textContent).not.toContain('LOCAL_CODE');
 await click('Документ');expect(panel.textContent).toContain('Безопасный GraphQL-документ недоступен');
 await click('Тесты');expect(panel.textContent).toContain('Без привязки к тесту');expect(getExecution).not.toHaveBeenCalled();
});
it('aborts late detail reads on rapid request selection and does not replace the current diagnostics',async()=>{const old=deferred<RequestDetail>();read.mockReturnValueOnce(old.promise);await render();await click('FindCustomer');const signal=read.mock.calls[0][2]!;expect(container.querySelector('[role=status]')?.textContent).toContain('Загружаем обращение');await click('ListOrders');expect(signal.aborted).toBe(true);await act(async()=>old.resolve(first));const panel=container.querySelector('[aria-label="Подробности обращения"]')!;expect(panel.querySelector('h2')?.textContent).toBe('ListOrders');expect(panel.querySelector('.request-quick-facts')?.textContent).toContain('Нет ошибок');expect(panel.querySelector('.request-diagnostic-section')).toBeNull();expect(panel.textContent).not.toContain('BAD_USER_INPUT')});
it.each(['run','service'] as const)('removes old request details and cancels their requests on %s changes',async context=>{const old=deferred<RequestDetail>();read.mockReturnValueOnce(old.promise);await render();await click('FindCustomer');const signal=read.mock.calls[0][2]!;if(context==='run')runId='another-run';else scope='another-service/session';await render();expect(signal.aborted).toBe(true);await act(async()=>old.resolve(first));expect(container.querySelector('[aria-label="Подробности обращения"]')).toBeNull()});
it('keeps close available in the fixed header and offers retry for protected detail failures',async()=>{read.mockRejectedValueOnce(new ApiError('http','denied',403)).mockResolvedValueOnce(first);await render();await click('FindCustomer');const close=container.querySelector<HTMLButtonElement>('[aria-label="Закрыть подробности обращения"]')!;expect(close.closest('header')).not.toBeNull();expect(container.querySelector('[role=alert]')?.textContent).toContain('Недостаточно прав');await click('Повторить загрузку обращения');expect(read).toHaveBeenCalledTimes(2);expect(container.querySelector('.graphql-error-details')).not.toBeNull();await act(async()=>close.click());expect(container.querySelector('[aria-label="Подробности обращения"]')).toBeNull()});
it('loads and paginates field evidence only in Fields without losing selected coordinates',async()=>{
 const selectedFields=Array.from({length:125},(_,index)=>({typeName:'Customer',fieldName:'field'+index,returnType:'String'}));
 const evidenceRows=selectedFields.map(field=>evidenceField({...field}));
 read.mockResolvedValueOnce({...first,selectedFields});
 evidence.mockResolvedValueOnce(evidencePage({total:125,fields:evidenceRows.slice(0,100)}))
  .mockResolvedValueOnce(evidencePage({total:125,offset:100,fields:evidenceRows.slice(100)}));
 await render();await click('FindCustomer');expect(evidence).not.toHaveBeenCalled();
 await click('Поля');expect(container.querySelectorAll('.evidence-field-link')).toHaveLength(125);
 expect(container.querySelectorAll('.evidence-badge[data-state=observed]')).toHaveLength(100);
 await click('Загрузить ещё Evidence');
 expect(evidence.mock.calls[1][3]).toBe(100);
 expect(container.querySelectorAll('.evidence-badge[data-state=observed]')).toHaveLength(125);
 expect(container.querySelector('.request-quick-facts')?.closest('.request-detail-body')).toBeNull();
});
it('keeps evidence and linked test failures retryable inside their lazy tabs',async()=>{
 evidence.mockRejectedValueOnce(new ApiError('http','denied',403));
 vi.mocked(getExecution).mockRejectedValueOnce(new ApiError('http','denied',403));
 await render();await click('FindCustomer');await click('Поля');
 expect(container.querySelector('[role=alert]')?.textContent).toContain('Недостаточно прав');
 await click('Повторить чтение Evidence');expect(evidence).toHaveBeenCalledTimes(2);
 await click('Тесты');expect(container.querySelector('[role=alert]')?.textContent).toContain('Недостаточно прав');
});
