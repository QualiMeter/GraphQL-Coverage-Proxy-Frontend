import {describe,expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {createElement} from 'react';
import {coverageFor} from '../testSupport/model';
import {initialStore} from '../testSupport/fixtures';
import {SchemaDetailPanel} from './SchemaDetailPanel';
import {currentStep,emptyHistory,moveStep,nestedRelations,pushStep,relationsFor,sdlMetadata,updateStep,type InvestigationHistory,type InvestigationStep} from './schemaInvestigation';
import {snapshotFromSDL} from '../testSupport/sdl';

const snapshot=initialStore.snapshots.find(item=>item.id==='customer-v2')!;
const run=initialStore.runs.find(item=>item.id==='reg13')!;
const types=coverageFor(snapshot,run,initialStore).types;
const viewport={x:12,y:24,zoom:.8};
const step=(id:string,kind:'type'|'field'='type',edgeId:string|null=null):InvestigationStep=>({id,kind,edgeId,tab:'Обзор',viewport});
const history=(...entries:InvestigationStep[]):InvestigationHistory=>({entries,index:entries.length-1});
const render=(entry:InvestigationStep)=>renderToStaticMarkup(createElement(SchemaDetailPanel,{types,snapshot,showAnalyticsLinks:true,canOpenRequests:true,history:history(entry),onBack:()=>{},onForward:()=>{},onClose:()=>{},onTab:()=>{},onType:()=>{},onField:()=>{},onOperations:()=>{},onRequests:()=>{}}));

describe('GraphQL schema investigation',()=>{
 it('shows selected type fields, coverage and current run usage',()=>{const html=render(step('Customer'));expect(html).toContain('Customer');expect(html).toContain('из 7 полей покрыто');expect(html).toContain('schema-type-progress');expect(html).not.toContain('schema-detail-breadcrumb');expect(html).toContain('orders');expect(html).toContain('hits')});
 it('shows exact field details, SDL arguments and observed use',()=>{const html=render(step('Query.customer','field'));expect(html).toContain('Query.customer');expect(html).toContain('Customer');expect(html).toContain('<code>id</code>');expect(html).toContain('<code>ID!</code>');expect(html).toContain('Показать операции');expect(html).toContain('Показать обращения')});
 it('derives incoming and outgoing relations from current snapshot',()=>{const relations=relationsFor(types);expect(relations).toContainEqual({id:'Customer.orders->Order',source:'Customer',field:'orders',target:'Order'});expect(relations).toContainEqual({id:'Query.customer->Customer',source:'Query',field:'customer',target:'Customer'});const html=render({...step('Customer'),tab:'Связи'});expect(html).toContain('Customer.orders → Order');expect(html).toContain('Query.customer → Customer')});
 it('limits nested dependencies to two transitions and ignores immediate cycles',()=>{const nested=nestedRelations('Customer',relationsFor(types));expect(nested).toContainEqual({first:{id:'Customer.orders->Order',source:'Customer',field:'orders',target:'Order'},second:{id:'Order.items->OrderItem',source:'Order',field:'items',target:'OrderItem'}});expect(nested.some(path=>path.second.target==='Customer')).toBe(false);expect(nested.some(path=>path.second.target==='Product')).toBe(false)});
 it('handles a cyclic schema without recursive traversal',()=>{const cycle=snapshotFromSDL('type Query { a: A } type A { b: B } type B { a: A }','test','cycle','cycle');const relations=relationsFor(cycle.types);expect(nestedRelations('A',relations)).toEqual([]);expect(relations).toHaveLength(3)});
 it('records outgoing and incoming transitions with selected edges',()=>{let h=pushStep(emptyHistory,step('Customer'));h=pushStep(h,step('Order','type','Customer.orders->Order'));expect(currentStep(h)?.edgeId).toBe('Customer.orders->Order');h=pushStep(h,step('Customer','type','Order.customer->Customer'));expect(currentStep(h)?.id).toBe('Customer');expect(currentStep(h)?.edgeId).toBe('Order.customer->Customer')});
 it('moves back and forward without creating duplicate entries',()=>{let h=history(step('Customer'),step('Order'),step('OrderItem'));h=moveStep(h,-1);expect(currentStep(h)?.id).toBe('Order');h=moveStep(h,-1);expect(currentStep(h)?.id).toBe('Customer');h=moveStep(h,1);expect(currentStep(h)?.id).toBe('Order');expect(h.entries).toHaveLength(3)});
 it('discards the future branch after a new transition',()=>{let h=moveStep(history(step('Customer'),step('Order'),step('OrderItem')),-1);h=moveStep(h,-1);h=pushStep(h,step('Address'));expect(h.entries.map(entry=>entry.id)).toEqual(['Customer','Address']);expect(moveStep(h,1)).toBe(h)});
 it('restores selected element, tab, viewport and zoom',()=>{let h=history(step('Customer'));h=updateStep(h,{tab:'SDL',viewport:{x:-80,y:42,zoom:1.1}});h=pushStep(h,step('Order'));h=moveStep(h,-1);expect(currentStep(h)).toMatchObject({id:'Customer',tab:'SDL',viewport:{x:-80,y:42,zoom:1.1}});expect(pushStep(h,step('Customer'))).toBe(h)});
 it('treats Explorer and graph selection as one history sequence',()=>{let h=pushStep(emptyHistory,step('Customer'));h=pushStep(h,step('Customer.orders','field'));h=pushStep(h,step('Order'));expect(h.entries.map(entry=>entry.kind)).toEqual(['type','field','type']);expect(moveStep(h,-1).entries).toHaveLength(3)});
 it('resets on another snapshot and uses its own relationships',()=>{const billing=initialStore.snapshots.find(item=>item.id==='billing-v1')!;expect(relationsFor(billing.types).some(relation=>relation.target==='Customer')).toBe(false);expect(emptyHistory.index).toBe(-1);expect(sdlMetadata(billing,'Invoice').definition).toContain('type Invoice')});
 it('recalculates coverage and hits for the selected run',()=>{const smoke=initialStore.runs.find(item=>item.id==='smoke')!;const first=coverageFor(snapshot,run,initialStore).types.find(type=>type.name==='Customer')!;const second=coverageFor(snapshot,smoke,initialStore).types.find(type=>type.name==='Customer')!;expect(first.fields.map(field=>field.hits)).not.toEqual(second.fields.map(field=>field.hits))});
 it('does not invent metadata absent from SDL',()=>{expect(sdlMetadata(snapshot,'Customer','orders')).toMatchObject({description:null,args:[],deprecationReason:null});expect(sdlMetadata(snapshot,'Unknown').definition).toBeNull()});
});
