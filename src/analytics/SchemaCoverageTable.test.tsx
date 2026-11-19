// @vitest-environment jsdom
import {act,type ComponentProps} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it,vi} from 'vitest';
import {snapshotFromSDL} from '../testSupport/sdl';
import {SchemaCoverageTable} from './SchemaCoverageTable';

it('scrolls to the first matching row once and keeps filtering and sorting independent of selection',async()=>{
 const types=snapshotFromSDL(`
  type Query { adminStats: ShopStats }
  type ShopStats { activeOrders: Int customers: Int revenueCents: Int }
 `,'service','schema','snapshot').types;
 types.flatMap(type=>type.fields).forEach((field,index)=>{field.hits=index+1;field.covered=true});
 const container=document.createElement('div');
 document.body.append(container);
 const root=createRoot(container);
 const onFilter=vi.fn(),onSort=vi.fn(),onQuery=vi.fn();
 const props:ComponentProps<typeof SchemaCoverageTable>={
  types,query:'',filter:'all',sort:'hits-asc',selectedType:'ShopStats',selectedField:null,onQuery,onFilter,onSort,onField:vi.fn(),
 };
 const render=(overrides:Partial<typeof props>={})=>act(async()=>root.render(<SchemaCoverageTable {...props} {...overrides}/>));
 const scroll=()=>container.querySelector<HTMLDivElement>('.schema-table-scroll')!;
 const rows=(selector='')=>Array.from(container.querySelectorAll<HTMLTableRowElement>(`tbody tr${selector}`),row=>row.cells[1].textContent);
 const rect=(top:number,height:number)=>({top,bottom:top+height,left:0,right:400,width:400,height,x:0,y:top,toJSON:()=>({})});
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
 const bounds=vi.spyOn(HTMLElement.prototype,'getBoundingClientRect').mockImplementation(function(this:HTMLElement){
  if(this.matches('th'))return rect(100,30);
  if(this.matches('tbody tr'))return rect(400,32);
  return rect(100,200);
 });
 const height=vi.spyOn(HTMLElement.prototype,'clientHeight','get').mockReturnValue(200);
 try{
  await render();
  expect(rows()).toEqual(['adminStats','activeOrders','customers','revenueCents']);
  expect(rows('.selected-type')).toEqual(['activeOrders','customers','revenueCents']);
  expect(scroll().scrollTop).toBe(270);
  scroll().scrollTop=100;
  await render({sort:'hits',query:'stats'});
  expect(rows()).toEqual(['revenueCents','customers','activeOrders','adminStats']);
  expect(scroll().scrollTop).toBe(100);
  await render({query:'customers'});
  expect(rows('.selected-type')).toEqual(['customers']);
  expect(scroll().scrollTop).toBe(100);
  await render({query:'customers',selectedType:null});
  expect(rows()).toEqual(['customers']);
  expect(rows('.selected-type')).toEqual([]);
  expect(onQuery).not.toHaveBeenCalled();
  expect(onFilter).not.toHaveBeenCalled();
  expect(onSort).not.toHaveBeenCalled();
 }finally{
  await act(async()=>root.unmount());
  bounds.mockRestore();
  height.mockRestore();
  vi.unstubAllGlobals();
  container.remove();
 }
});
