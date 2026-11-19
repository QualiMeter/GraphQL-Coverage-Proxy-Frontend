// @vitest-environment jsdom
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {BackendRequests} from './BackendRunAnalytics';
import {ExportWorkspace,useExportWorkspace} from './ExportWorkspace';
import {getFilteredJournal,getRequestDetail,type RequestOut} from '../api/runAnalytics';
vi.mock('../api/runAnalytics',async original=>({...await original<object>(),getFilteredJournal:vi.fn(),getRequestDetail:vi.fn()}));
vi.mock('./useRequestPathSearch',()=>({useRequestPathSearch:()=>({state:undefined,next:()=>{},cancel:()=>{},getDetail:()=>undefined})}));
const request:RequestOut={id:'first',runId:'run',operationName:'ExactName',operationType:'query',httpMethod:'POST',httpStatus:200,analysisStatus:'success',responseHasData:true,graphqlHasErrors:true,durationMs:142,createdAt:'2026-11-19T00:00:12Z',errorCode:null};
const rows:RequestOut[]=[request,{...request,id:'second',operationName:null,operationType:'mutation',httpStatus:404,graphqlHasErrors:null,analysisStatus:'validation_error',durationMs:null,createdAt:'2026-11-19T00:00:13Z'},{...request,id:'third',operationName:'Subscription',operationType:'subscription',httpStatus:503,graphqlHasErrors:false,analysisStatus:'unsupported'}];
let root:Root,container:HTMLDivElement,context:boolean,path:boolean,role:string|undefined;
const clear=vi.fn();
function ExportProbe(){const store=useExportWorkspace();return <output aria-label="Параметры экспорта">{JSON.stringify(store?.filters.requests)}</output>}
function App(){return <ExportWorkspace><ExportProbe/><BackendRequests runId="run" snapshotId="snapshot" scope="scope" revision={0} role={role} field={context?'Query.viewer':''} operationKey={context?'structure':''} testExecutionId={context?'execution':undefined} requestPath={path?[{typeName:'Query',fieldName:'viewer'}]:undefined} filter="all" sort="date" types={[]} onField={()=>{}} onRequests={()=>{}} onOperation={()=>{}} onClearContext={clear}/></ExportWorkspace>}
const render=()=>act(async()=>root.render(<App/>));
const button=(text:string)=>Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(el=>el.textContent?.trim()===text)!;
const toggle=()=>container.querySelector<HTMLButtonElement>('.request-filter-toggle')!;
const click=(el:HTMLElement)=>act(async()=>el.click());
const combo=(label:string)=>Array.from(container.querySelectorAll<HTMLButtonElement>('[role=combobox]')).find(el=>document.getElementById(el.getAttribute('aria-labelledby')!)?.textContent===label)!;
async function choose(label:string,text:string){await click(combo(label));await click(Array.from(document.querySelectorAll<HTMLElement>('[role=option]')).find(el=>el.textContent?.trim()===text)!);}
async function input(label:string,value:string){await act(async()=>{const el=container.querySelector<HTMLInputElement>(`[aria-label="${label}"]`)!;Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}))})}
const lastQuery=()=>vi.mocked(getFilteredJournal).mock.calls.at(-1)![1];
beforeEach(()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);context=false;path=false;role='analyst';clear.mockReset();
 vi.mocked(getFilteredJournal).mockReset().mockResolvedValue({rows,more:true});
 vi.mocked(getRequestDetail).mockReset().mockImplementation(()=>new Promise(()=>{}));
 container=document.createElement('div');document.body.append(container);root=createRoot(container);
});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();vi.unstubAllGlobals()});

it('keeps filters collapsed, submits exact search and resets pagination only on server changes',async()=>{
 await render();expect(toggle().getAttribute('aria-expanded')).toBe('false');
 expect(container.querySelectorAll('[role=combobox]')).toHaveLength(0);
 expect(container.textContent).not.toContain('Статистика прогона');
 await input('Точное имя операции','ExactName');expect(vi.mocked(getFilteredJournal)).toHaveBeenCalledOnce();
 await click(button('Найти'));expect(lastQuery().operationName).toBe('ExactName');
 await click(button('Далее'));expect(vi.mocked(getFilteredJournal).mock.calls.at(-1)![2]).toBe(50);
 await click(toggle());await choose('Тип операции','Mutation');
 expect(lastQuery()).toMatchObject({operationName:'ExactName',operationType:'mutation'});
 expect(vi.mocked(getFilteredJournal).mock.calls.at(-1)![2]).toBe(0);
 const count=vi.mocked(getFilteredJournal).mock.calls.length;
 await click(toggle());expect(toggle().textContent).toContain('Фильтры · 1');expect(vi.mocked(getFilteredJournal)).toHaveBeenCalledTimes(count);
 await click(toggle());expect(combo('Тип операции').textContent).toContain('Mutation');
 await choose('Статусы обращений','HTTP 4xx/5xx');expect(vi.mocked(getFilteredJournal).mock.calls.at(-1)![3]).toBe('http');
 await choose('Сортировка обращений','По длительности');await choose('Направление сортировки','По возрастанию');
 expect(lastQuery()).toMatchObject({sortBy:'durationMs',sortOrder:'asc'});
 await click(button('Сбросить'));expect(lastQuery()).toMatchObject({sortBy:'createdAt',sortOrder:'desc',operationName:undefined,operationType:undefined});expect(clear).toHaveBeenCalledOnce();
});

it('preserves contextual and export parameters while filters are hidden',async()=>{
 context=true;await render();
 expect(lastQuery()).toMatchObject({operationKey:'structure',testExecutionId:'execution',typeName:'Query',fieldName:'viewer'});
 await click(toggle());expect(combo('Поле схемы').textContent).toContain('Query.viewer');
 await choose('Статусы обращений','GraphQL-ошибки');await input('Точный HTTP-код','200');
 await input('Начало интервала','2026-11-18T12:30');await input('Конец интервала','2026-11-20T12:30');
 await click(toggle());
 const exported=JSON.parse(container.querySelector('[aria-label="Параметры экспорта"]')!.textContent!);
 expect(exported).toMatchObject({operationKey:'structure',testExecutionId:'execution',typeName:'Query',fieldName:'viewer',graphqlHasErrors:true,httpStatus:200,from:new Date('2026-11-18T12:30').toISOString(),to:new Date('2026-11-20T12:30').toISOString()});
});

it('renders nullable and independent status columns, seconds, and selected requests',async()=>{
 await render();
 const rendered=container.querySelectorAll<HTMLTableRowElement>('.requests-table tbody tr');
 expect(rendered[0].querySelector('time')?.textContent).toContain(':12');
 expect(rendered[1].querySelector('time')?.textContent).toContain(':13');
 expect(rendered[0].cells[3].textContent).toBe('200');expect(rendered[0].cells[4].textContent).toBe('Есть');expect(rendered[0].cells[6].textContent).toBe('Успешно');
 expect(rendered[1].cells[4].textContent).toBe('Неизвестно');expect(rendered[1].cells[3].querySelector('[data-tone=warning]')).toBeTruthy();
 expect(rendered[2].cells[3].querySelector('[data-tone=error]')).toBeTruthy();expect(rendered[2].cells[4].textContent).toBe('Нет');
 expect(rendered[1].cells[1].textContent).toBe('Без имени');expect(rendered[0].cells[5].textContent).toBe('142 мс');
 await click(button('ExactName'));expect(container.querySelector('.requests-table tr.selected')).toBeTruthy();expect(vi.mocked(getRequestDetail)).toHaveBeenCalledWith('run','first',expect.any(AbortSignal));
 await click(container.querySelector<HTMLButtonElement>('[aria-label="Закрыть подробности обращения"]')!);expect(container.querySelector('.requests-table tr.selected')).toBeNull();
});

it('keeps path mode filters disabled and journal access restricted',async()=>{
 path=true;await render();expect(container.querySelector('fieldset')?.disabled).toBe(true);expect(vi.mocked(getFilteredJournal)).not.toHaveBeenCalled();
 role=undefined;await render();expect(container.querySelector('.request-search-row')).toBeNull();expect(container.textContent).toContain('Войдите в систему');expect(vi.mocked(getFilteredJournal)).not.toHaveBeenCalled();
});
