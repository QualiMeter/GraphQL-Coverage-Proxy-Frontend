// @vitest-environment jsdom
import {act,createElement} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {SchemaDetailPanel} from './SchemaDetailPanel';
import {emptyHistory,moveStep,pushStep,type InvestigationHistory} from './schemaInvestigation';
import {snapshotFromSDL} from '../testSupport/sdl';
import {evidenceField,evidencePage,evidenceRun,evidenceSnapshot} from '../testSupport/fieldEvidence';
import {getEvidencePage,type FieldEvidencePage} from '../api/fieldEvidence';

vi.mock('../api/fieldEvidence',async original=>({...await original<object>(),getEvidencePage:vi.fn()}));
const snapshot=snapshotFromSDL('type Query { product: Product, item: OrderItem } type Product { id: ID!, stock: Int } type OrderItem { totalCents: Int }','service','snapshot','schema');
let root:Root,container:HTMLDivElement,history:InvestigationHistory,runId:string,scope:string,snapshotId:string;
const load=vi.mocked(getEvidencePage);
const noop=()=>{};
function renderPanel(){
 root.render(createElement(SchemaDetailPanel,{
  types:snapshot.types,snapshot,history,runId,snapshotId,resourceScope:scope,canOpenRequests:true,
  onBack:()=>{history=moveStep(history,-1);renderPanel()},
  onForward:()=>{history=moveStep(history,1);renderPanel()},
  onClose:noop,onTab:noop,onType:noop,onField:noop,onOperations:noop,onRequests:noop,
 }));
}
async function select(id:string){
 await act(async()=>{
  history=pushStep(history,{kind:'field',id,edgeId:null,tab:'Обзор',viewport:{x:0,y:0,zoom:1}});
  renderPanel();
 });
}
function check(id:string){
 expect(container.querySelector('h2')?.textContent).toBe(id);
 expect(container.querySelector('[role=tab][aria-selected=true]')?.textContent).toBe('Обзор');
 expect(container.querySelectorAll('.object-field-evidence')).toHaveLength(1);
 expect(container.querySelectorAll('.object-field-evidence h3')).toHaveLength(1);
 expect(container.querySelector('.object-field-evidence h3')?.textContent).toContain('Наличие поля в ответах');
 expect(container.querySelectorAll('.field-response-evidence,.field-request-paths,.object-field-paths')).toHaveLength(0);
}
function checkCount(count:number){
 expect(container.querySelectorAll('.object-evidence-total')).toHaveLength(1);
 expect(container.querySelector('.object-evidence-total strong')?.textContent).toBe(count+' из '+count);
}
function checkLoading(){
 expect(container.querySelector('.object-evidence-total')).toBeNull();
 expect(container.querySelector('.object-field-evidence [role=status]')?.textContent).toContain('Загружаем Field Evidence');
}
function checkRequest(index:number,typeName:string,fieldName:string){
 expect(load.mock.calls[index].slice(0,4)).toEqual([runId,snapshotId,{typeName,fieldName},0]);
 expect(load.mock.calls[index][4]).toBeInstanceOf(AbortSignal);
}
async function travel(label:string){
 await act(async()=>{
  const button=[...container.querySelectorAll('button')].find(el=>el.textContent===label)!;
  expect(button.disabled).toBe(false);
  button.click();
 });
}
function deferred(){
 let resolve!:(value:FieldEvidencePage)=>void;
 const promise=new Promise<FieldEvidencePage>(done=>{resolve=done});
 return {promise,resolve};
}
function result(typeName:string,fieldName:string,count:number,run=runId,schema=snapshotId){
 return evidencePage({runId:run,snapshotId:schema,requestCount:count,fields:[evidenceField({typeName,fieldName,selectedRequestCount:count,observedHits:count})]});
}
beforeEach(()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
 container=document.createElement('div');document.body.append(container);root=createRoot(container);
 history=emptyHistory;runId=evidenceRun;snapshotId=evidenceSnapshot;scope='service/session';
 load.mockReset();
 load.mockImplementation(async(run,schema,query)=>{
  if(query.requestId!==undefined)throw new Error('Expected field coordinate');
  return result(query.typeName,query.fieldName,1,run,schema);
 });
});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();vi.unstubAllGlobals();vi.restoreAllMocks()});

it('keeps exactly one Overview Evidence block through repeated field selection and back/forward navigation',async()=>{
 const errors=vi.spyOn(console,'error').mockImplementation(()=>{});
 for(let repeat=0;repeat<3;repeat++){
  for(const id of ['Product.id','Product.stock','OrderItem.totalCents','Product.id']){
   const previousIndex=history.index,calls=load.mock.calls.length;
   await select(id);check(id);checkCount(1);
   expect(load).toHaveBeenCalledTimes(calls+(history.index===previousIndex?0:1));
   const [typeName,fieldName]=id.split('.');
   checkRequest(load.mock.calls.length-1,typeName,fieldName);
  }
 }
 for(const [direction,id] of [['← Назад','OrderItem.totalCents'],['← Назад','Product.stock'],['Вперёд →','OrderItem.totalCents'],['Вперёд →','Product.id']]){
  const calls=load.mock.calls.length;
  await travel(direction);check(id);checkCount(1);
  expect(load).toHaveBeenCalledTimes(calls+1);
  const [typeName,fieldName]=id.split('.');
  checkRequest(calls,typeName,fieldName);
 }
 expect(errors.mock.calls.flat().join(' ')).not.toMatch(/same key|unique.*key/);
});

it('cancels superseded field requests and ignores late responses even after returning to the same coordinate',async()=>{
 const old=deferred(),stock=deferred(),total=deferred(),current=deferred();
 load.mockReturnValueOnce(old.promise).mockReturnValueOnce(stock.promise).mockReturnValueOnce(total.promise).mockReturnValueOnce(current.promise);
 await select('Product.id');checkLoading();checkRequest(0,'Product','id');
 await select('Product.stock');check('Product.stock');checkLoading();checkRequest(1,'Product','stock');
 expect(load.mock.calls[0][4]!.aborted).toBe(true);
 await select('OrderItem.totalCents');check('OrderItem.totalCents');checkLoading();checkRequest(2,'OrderItem','totalCents');
 expect(load.mock.calls[1][4]!.aborted).toBe(true);
 await select('Product.id');check('Product.id');checkLoading();checkRequest(3,'Product','id');
 expect(load.mock.calls[2][4]!.aborted).toBe(true);
 expect(load.mock.calls[3][4]!.aborted).toBe(false);
 await act(async()=>current.resolve(result('Product','id',7)));checkCount(7);
 for(const [pending,response] of [[old,result('Product','id',999)],[stock,result('Product','stock',888)],[total,result('OrderItem','totalCents',777)]] as const){
  await act(async()=>pending.resolve(response));
  check('Product.id');checkCount(7);
  expect(container.textContent).not.toMatch(/999|888|777/);
 }
 await travel('← Назад');check('OrderItem.totalCents');checkCount(1);
 await travel('Вперёд →');check('Product.id');checkCount(1);
});

it('automatically loads the new field in Overview and clears previously loaded evidence while waiting',async()=>{
 const next=deferred();
 load.mockResolvedValueOnce(result('Product','id',3)).mockReturnValueOnce(next.promise);
 await select('Product.id');checkCount(3);
 await select('Product.stock');check('Product.stock');checkLoading();
 expect(load).toHaveBeenCalledTimes(2);checkRequest(1,'Product','stock');
 expect(load.mock.calls[0][4]!.aborted).toBe(true);
 expect(load.mock.calls[1][4]!.aborted).toBe(false);
 await act(async()=>next.resolve(result('Product','stock',5)));checkCount(5);
});

it.each(['run','snapshot','service'] as const)('cancels old Evidence, clears loaded state and rejects stale responses when changing %s',async context=>{
 const old=deferred(),next=deferred(),returned=deferred();
 const stale=result('Product','id',999);
 load.mockReturnValueOnce(old.promise).mockReturnValueOnce(next.promise).mockReturnValueOnce(returned.promise);
 await select('Product.id');checkLoading();checkRequest(0,'Product','id');
 const oldSignal=load.mock.calls[0][4]!;
 await act(async()=>{
  if(context==='run')runId=evidenceSnapshot;
  else if(context==='snapshot')snapshotId=evidenceRun;
  else scope='other-service/session';
  renderPanel();
 });
 check('Product.id');checkLoading();expect(oldSignal.aborted).toBe(true);
 expect(load).toHaveBeenCalledTimes(2);checkRequest(1,'Product','id');
 const nextSignal=load.mock.calls[1][4]!;expect(nextSignal.aborted).toBe(false);
 await act(async()=>next.resolve(result('Product','id',4)));checkCount(4);
 await act(async()=>old.resolve(stale));check('Product.id');checkCount(4);expect(container.textContent).not.toContain('999');
 // Returning to the original context must fetch again, with no cached late or previously displayed value.
 await act(async()=>{runId=evidenceRun;snapshotId=evidenceSnapshot;scope='service/session';renderPanel()});
 check('Product.id');checkLoading();expect(nextSignal.aborted).toBe(true);
 expect(load).toHaveBeenCalledTimes(3);checkRequest(2,'Product','id');
 expect(load.mock.calls[2][4]!.aborted).toBe(false);
 await act(async()=>returned.resolve(result('Product','id',6)));checkCount(6);expect(container.textContent).not.toContain('999');
});
