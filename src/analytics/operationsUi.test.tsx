// @vitest-environment jsdom
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {beforeEach,afterEach,expect,it,vi} from 'vitest';
import {getOperations,type OperationOut} from '../api/runAnalytics';
import {BackendOperations} from './BackendRunAnalytics';
import {ExportWorkspace} from './ExportWorkspace';
import {ExportCenter} from './ExportCenter';
import {defaultOperationAdvanced,matchesOperation} from './runAnalyticsModel';
import {operationExportBlocked} from './exportFilters';

vi.mock('../api/runAnalytics',async original=>({...await original<object>(),getOperations:vi.fn()}));
const operations:OperationOut[]=[
 {operationKey:'http-structure-123456789',operationName:null,operationType:'query',requestCount:1,countedRequestCount:0,httpErrorCount:1,graphqlErrorCount:0,avgDurationMs:600,lastSeenAt:'2026-11-19T00:00:00Z',fields:[{typeName:'Query',fieldName:'user',hits:1},{typeName:'User',fieldName:'id',hits:1}]},
 {operationKey:'graphql-structure',operationName:'Update',operationType:'mutation',requestCount:3,countedRequestCount:2,httpErrorCount:0,graphqlErrorCount:1,avgDurationMs:100,lastSeenAt:'2026-11-19T00:00:00Z',fields:[{typeName:'User',fieldName:'name',hits:2}]},
 {operationKey:'clean-structure',operationName:'Read',operationType:'query',requestCount:7,countedRequestCount:7,httpErrorCount:0,graphqlErrorCount:0,avgDurationMs:null,lastSeenAt:'2026-11-19T00:00:00Z',fields:[]},
];
let root:Root,container:HTMLDivElement,revision:number;
const onField=vi.fn(),onRequests=vi.fn();
function Workspace(){return <ExportWorkspace><ExportCenter runId="run" snapshotId="snapshot" serviceId="service" role="operator" comparisonMode={false}/><BackendOperations runId="run" scope="scope" revision={revision} role="operator" field="" operationKey="" filter="" sort="" types={[]} onField={onField} onRequests={onRequests} onOperation={()=>{}} onClearContext={()=>{}}/></ExportWorkspace>}
const render=()=>act(async()=>root.render(<Workspace/>));
const button=(text:string)=>Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(el=>el.textContent?.trim()===text)!;
const click=(el:HTMLElement)=>act(async()=>el.click());
const combo=(label:string)=>Array.from(container.querySelectorAll<HTMLButtonElement>('[role=combobox]')).find(el=>document.getElementById(el.getAttribute('aria-labelledby')!)?.textContent===label)!;
const choose=async(label:string,value:string)=>{await click(combo(label));await click(Array.from(document.querySelectorAll<HTMLElement>('[role=option]')).find(el=>el.textContent?.trim()===value)!);if(combo(label).getAttribute('aria-expanded')==='true')await act(async()=>combo(label).dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})))};
const names=()=>Array.from(container.querySelectorAll('.operations-table .operation-name'),el=>el.textContent);
async function search(value:string){await act(async()=>{const el=container.querySelector<HTMLInputElement>('[aria-label="Поиск операции"]')!;Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}))})}
beforeEach(()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
 Object.defineProperty(HTMLDialogElement.prototype,'showModal',{configurable:true,value:function(this:HTMLDialogElement){this.open=true}});
 Object.defineProperty(HTMLDialogElement.prototype,'close',{configurable:true,value:function(this:HTMLDialogElement){this.open=false}});
 container=document.createElement('div');document.body.append(container);root=createRoot(container);revision=0;
 vi.mocked(getOperations).mockResolvedValue(operations);onField.mockReset();onRequests.mockReset();
});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();vi.unstubAllGlobals()});

it('combines error categories with OR and additional conditions with AND',async()=>{
 await render();
 await choose('Тип ошибок','С HTTP-ошибками');expect(names()).toEqual(['Без имени']);
 await choose('Тип ошибок','С GraphQL-ошибками');expect(names()).toEqual(['Update','Без имени']);
 await choose('Тип ошибок','Без HTTP- и GraphQL-ошибок');expect(names()).toHaveLength(3);
 await choose('Тип ошибок','Все операции');
 await click(button('Дополнительные фильтры'));
 await choose('Частота обращений','2–4');
 await choose('Учёт в покрытии','Частично');
 expect(names()).toEqual(['Update']);
 await choose('Среднее время ответа','От 500 мс');expect(names()).toEqual([]);
 await click(button('Сбросить'));expect(names()).toHaveLength(3);
 await search('http-structure');expect(names()).toEqual(['Без имени']);
 expect(container.querySelector('.operation-identity')?.textContent).toContain('ID структуры: http-structu…');
});

it('retains selection across refresh, closes hidden selection, and preserves detail navigation',async()=>{
 await render();await click(button('Без имени'));
 expect(container.querySelector('.operation-detail h2')?.textContent).toBe('Без имени');
 await click(button('Показать обращения'));expect(onRequests).toHaveBeenCalledWith(operations[0].operationKey);
 await click(button('Затронутые поля'));await click(button('id1 Hits›'));expect(onField).toHaveBeenCalledWith('User','id');
 revision++;await render();expect(container.querySelector('.operation-detail')).toBeTruthy();
 await search('Update');expect(container.querySelector('.operation-detail')).toBeNull();
 await search('');expect(container.querySelector('.operation-detail')).toBeNull();
});

it('blocks incompatible filtered exports, explains the limitation and permits unfiltered exports',async()=>{
 await render();await choose('Тип ошибок','С HTTP-ошибками');await click(button('Экспорт'));
 const checkbox=Array.from(document.querySelectorAll<HTMLInputElement>('.export-datasets input')).find(el=>el.parentElement?.textContent==='Операции')!;
 await click(checkbox);expect(button('Экспортировать').disabled).toBe(true);
 expect(document.querySelector('.export-note')?.textContent).toContain('Точный экспорт операций');
 await click(document.querySelector<HTMLInputElement>('.export-filter-toggle input')!);
 expect(button('Экспортировать').disabled).toBe(false);
});

it('supports keyboard multi-selection and Escape without changing other selects',async()=>{
 await render();const trigger=combo('Тип ошибок');
 await act(async()=>{trigger.focus();trigger.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}))});
 await act(async()=>trigger.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true})));
 await act(async()=>trigger.dispatchEvent(new KeyboardEvent('keydown',{key:' ',bubbles:true})));
 expect(names()).toEqual(['Без имени']);expect(trigger.getAttribute('aria-expanded')).toBe('true');
 await act(async()=>trigger.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})));
 expect(trigger.getAttribute('aria-expanded')).toBe('false');
});

it('preserves count semantics, unknown durations and export restrictions',()=>{
 expect(matchesOperation(operations[2],'','','',[],{...defaultOperationAdvanced,duration:'100'})).toBe(false);
 expect(matchesOperation(operations[1],'','','',['http','graphql'],{...defaultOperationAdvanced,coverage:'partial'})).toBe(true);
 expect(matchesOperation(operations[0],'','','',[],{...defaultOperationAdvanced,coverage:'none',anonymous:true})).toBe(true);
 expect(matchesOperation(operations[0],'','','',[],{...defaultOperationAdvanced,duration:'custom',minMs:''})).toBe(false);
 expect(operationExportBlocked('',['http','graphql'],defaultOperationAdvanced)).toBe(false);
 expect(operationExportBlocked('',['http','graphql','none'],defaultOperationAdvanced)).toBe(false);
 expect(operationExportBlocked('',['none'],defaultOperationAdvanced)).toBe(true);
 expect(operationExportBlocked('key',[],defaultOperationAdvanced)).toBe(true);
});
