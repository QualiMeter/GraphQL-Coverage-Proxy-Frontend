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
function renderPanel(){root.render(createElement(SchemaDetailPanel,{types:snapshot.types,snapshot,history,runId,snapshotId,resourceScope:scope,canOpenRequests:true,onBack:()=>{history=moveStep(history,-1);renderPanel()},onForward:()=>{history=moveStep(history,1);renderPanel()},onClose:noop,onTab:noop,onType:noop,onField:noop,onOperations:noop,onRequests:noop}))}
async function select(id:string){await act(async()=>{history=pushStep(history,{kind:'field',id,edgeId:null,tab:'Обзор',viewport:{x:0,y:0,zoom:1}});renderPanel()})}
function check(id:string){expect(container.querySelector('h2')?.textContent).toBe(id);expect([...container.querySelectorAll('summary')].filter(el=>el.textContent==='Наличие поля в ответах')).toHaveLength(1);expect(container.querySelectorAll('.field-response-evidence')).toHaveLength(1);expect(container.querySelectorAll('.field-request-paths')).toHaveLength(1)}
async function expand(){await act(async()=>{const details=container.querySelector<HTMLDetailsElement>('.field-response-evidence')!;details.open=true;details.dispatchEvent(new Event('toggle'))})}
async function travel(label:string){await act(async()=>{const button=[...container.querySelectorAll('button')].find(el=>el.textContent===label)!;expect(button.disabled).toBe(false);button.click()})}
function deferred(){let resolve!:(value:FieldEvidencePage)=>void;const promise=new Promise<FieldEvidencePage>(done=>{resolve=done});return {promise,resolve}}
function result(typeName:string,fieldName:string,count:number,run=runId){return evidencePage({runId:run,requestCount:count,fields:[evidenceField({typeName,fieldName,selectedRequestCount:count,observedHits:count})]})}
beforeEach(()=>{vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);container=document.createElement('div');document.body.append(container);root=createRoot(container);history=emptyHistory;runId=evidenceRun;snapshotId=evidenceSnapshot;scope='service/session';load.mockReset();load.mockResolvedValue(evidencePage());});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();vi.unstubAllGlobals();vi.restoreAllMocks()});

it('keeps exactly one Evidence block through repeated field selection and back/forward navigation',async()=>{
 const errors=vi.spyOn(console,'error').mockImplementation(()=>{});
 for(let repeat=0;repeat<3;repeat++)for(const id of ['Product.id','Product.stock','OrderItem.totalCents','Product.id']){await select(id);check(id)}
 await travel('← Назад');check('OrderItem.totalCents');await travel('← Назад');check('Product.stock');await travel('Вперёд →');check('OrderItem.totalCents');await travel('Вперёд →');check('Product.id');
 expect(errors.mock.calls.flat().join(' ')).not.toMatch(/same key|unique.*key/);
 expect(load).not.toHaveBeenCalled();
});
it('removes an open old block, cancels its request and ignores a late response after rapid selection',async()=>{
 const old=deferred(),next=deferred();load.mockReturnValueOnce(old.promise).mockReturnValueOnce(next.promise);
 await select('Product.id');await expand();const signal=load.mock.calls[0][4]!;expect(load.mock.calls[0][2]).toEqual({typeName:'Product',fieldName:'id'});
 await select('Product.stock');check('Product.stock');expect(signal.aborted).toBe(true);expect(container.querySelector('details.field-response-evidence')?.hasAttribute('open')).toBe(false);
 await select('OrderItem.totalCents');check('OrderItem.totalCents');await select('Product.id');check('Product.id');await expand();expect(load.mock.calls[1][2]).toEqual({typeName:'Product',fieldName:'id'});
 await act(async()=>next.resolve(result('Product','id',7)));expect(container.querySelector('.evidence-main-counts')?.textContent).toContain('7');
 await act(async()=>old.resolve(result('Product','id',999)));check('Product.id');expect(container.textContent).not.toContain('999');expect(container.querySelector('.evidence-main-counts')?.textContent).toContain('7');
 await travel('← Назад');check('OrderItem.totalCents');expect(container.querySelector('.evidence-main-counts')).toBeNull();await travel('Вперёд →');check('Product.id');
});
it('loads the newly selected coordinate when switching with the disclosure open',async()=>{
 await select('Product.id');await expand();await select('Product.stock');check('Product.stock');load.mockResolvedValueOnce(result('Product','stock',5));await expand();expect(load.mock.calls.at(-1)?.[2]).toEqual({typeName:'Product',fieldName:'stock'});expect(container.querySelector('.evidence-main-counts')?.textContent).toContain('5');
});
it.each(['run','snapshot','service'] as const)('resets the disclosure and rejects stale results after changing %s',async context=>{
 const old=deferred();load.mockReturnValueOnce(old.promise);await select('Product.id');await expand();const signal=load.mock.calls[0][4]!;
 await act(async()=>{if(context==='run')runId=evidenceSnapshot;else if(context==='snapshot')snapshotId=evidenceRun;else scope='other-service/session';renderPanel()});check('Product.id');expect(signal.aborted).toBe(true);expect(container.querySelector('.evidence-main-counts')).toBeNull();
 load.mockResolvedValueOnce(result('Product','id',4));await expand();expect(load.mock.calls.at(-1)?.slice(0,2)).toEqual([runId,snapshotId]);await act(async()=>old.resolve(result('Product','id',999,evidenceRun)));check('Product.id');expect(container.textContent).not.toContain('999');expect(container.querySelector('.evidence-main-counts')?.textContent).toContain('4');
});
