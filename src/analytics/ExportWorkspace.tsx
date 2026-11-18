import {createContext,useCallback,useContext,useLayoutEffect,useMemo,useState,type ReactNode,type SetStateAction} from 'react';
import type {ComparisonExport,Dataset,ExportFilters} from '../api/exports';
type Slot={reset:string;value:unknown};
type Store={slots:Record<string,Slot>;filters:ExportFilters;warnings:Partial<Record<Dataset,string[]>>;comparison:ComparisonExport|null;setSlot:(key:string,reset:string,initial:unknown,update:SetStateAction<unknown>)=>void;publish:(section:Dataset,params:ExportFilters[Dataset],warnings:string[])=>void;setComparison:(comparison:ComparisonExport|null)=>void};
const Context=createContext<Store|null>(null);
export function ExportWorkspace({children}:{children:ReactNode}){
 const [slots,setSlots]=useState<Record<string,Slot>>({}),[filters,setFilters]=useState<ExportFilters>({}),[warnings,setWarnings]=useState<Store['warnings']>({}),[comparison,setComparison]=useState<ComparisonExport|null>(null);
 const setSlot=useCallback<Store['setSlot']>((key,reset,initial,update)=>setSlots(old=>{const current=old[key]?.reset===reset?old[key].value:initial;return {...old,[key]:{reset,value:typeof update==='function'?update(current):update}}}),[]);
 const publish=useCallback<Store['publish']>((section,params,notes)=>{setFilters(old=>({...old,[section]:params}));setWarnings(old=>({...old,[section]:notes}))},[]);
 const value=useMemo(()=>({slots,filters,warnings,comparison,setSlot,publish,setComparison}),[slots,filters,warnings,comparison,setSlot,publish]);
 return <Context.Provider value={value}>{children}</Context.Provider>;
}
export const useExportWorkspace=()=>useContext(Context);
export function useExportFilterState<T>(section:string,key:string,initial:T,reset=''):[T,(update:SetStateAction<T>)=>void]{
 const store=useExportWorkspace(),[local,setLocal]=useState(initial),id=`${section}:${key}`;
 return store?[store.slots[id]?.reset===reset?store.slots[id].value as T:initial,update=>store.setSlot(id,reset,initial,update as SetStateAction<unknown>)]:[local,setLocal];
}
export function usePublishExport(section:Dataset,params:ExportFilters[Dataset],warnings:string[]=[]){
 const publish=useExportWorkspace()?.publish,key=JSON.stringify([params,warnings]);
 const value=useMemo(()=>JSON.parse(key) as [ExportFilters[Dataset],string[]],[key]);
 useLayoutEffect(()=>{publish?.(section,value[0],value[1])},[publish,section,value]);
}
export function useComparisonExport(value:ComparisonExport|null){
 const publish=useExportWorkspace()?.setComparison,key=JSON.stringify(value);
 const record=useMemo(()=>JSON.parse(key) as ComparisonExport|null,[key]);
 useLayoutEffect(()=>{publish?.(record);return ()=>publish?.(null)},[publish,record]);
}
