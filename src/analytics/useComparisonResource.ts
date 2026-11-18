import {useEffect,useRef,useState} from 'react';
export function resourceValue<T>(key:string|null,attempt:number,result?:{key:string;attempt:number;data?:T;error?:Error}){
 return key!==null&&result?.key===key&&result.attempt===attempt?result:undefined;
}
export function useComparisonResource<T>(key:string|null,load:(signal:AbortSignal)=>Promise<T>){
 const loader=useRef(load);loader.current=load;
 const [attempt,setAttempt]=useState(0);
 const [result,setResult]=useState<{key:string;attempt:number;data?:T;error?:Error}>();
 useEffect(()=>{
  if(key===null)return;
  const controller=new AbortController();
  void loader.current(controller.signal).then(data=>{if(!controller.signal.aborted)setResult({key,attempt,data})},(error:Error)=>{if(!controller.signal.aborted)setResult({key,attempt,error})});
  return ()=>controller.abort();
 },[key,attempt]);
 const current=resourceValue(key,attempt,result);
 return {data:current?.data,error:current?.error,loading:key!==null&&!current,retry:()=>setAttempt(v=>v+1)};
}
