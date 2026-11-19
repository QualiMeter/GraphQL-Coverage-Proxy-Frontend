import {useEffect,useMemo,useRef,useState} from 'react';
import type {RunOut} from '../api/runs';
import {readRunPreference} from './workspaceSelection';
import {resolveServiceRun} from './autoRunSelection';
type Result={identity:string;attempt:number;status:'done'|'manual'|'error';error?:Error};
export function useAutoRunSelection({owner,serviceId,scope,snapshots,ready,enabled,onResolve}:{owner:string;serviceId:string|null;scope:string;snapshots:readonly {id:string}[];ready:boolean;enabled:boolean;onResolve:(run:RunOut|null)=>void}){
 const [attempt,setAttempt]=useState(0),[result,setResult]=useState<Result>();
 const identity=JSON.stringify([owner,serviceId,scope]);
 const snapshotIds=JSON.stringify(snapshots.map(snapshot=>snapshot.id));
 const candidates=useMemo(()=> (JSON.parse(snapshotIds) as string[]).map(id=>({id})),[snapshotIds]);
 const request=JSON.stringify([identity,snapshotIds,attempt,ready,enabled]);
 const currentRequest=useRef(request);currentRequest.current=request;
 const settled=useRef<string|null>(null),active=useRef<AbortController|null>(null),resolve=useRef(onResolve);resolve.current=onResolve;
 useEffect(()=>{
  if(!serviceId||!ready||!enabled||settled.current===identity)return;
  const controller=new AbortController();active.current=controller;
  void resolveServiceRun(serviceId,candidates,readRunPreference(owner,serviceId),controller.signal).then(run=>{
   if(controller.signal.aborted||currentRequest.current!==request||settled.current===identity)return;
   settled.current=identity;
   setResult({identity,attempt,status:'done'});
   resolve.current(run);
  },(error:Error)=>{if(!controller.signal.aborted&&currentRequest.current===request&&settled.current!==identity)setResult({identity,attempt,status:'error',error})});
  return ()=>controller.abort();
 // Snapshot IDs in request define the catalog used by the in-flight decision.
 },[request,identity,owner,serviceId,attempt,ready,enabled,candidates]);
 const current=result?.identity===identity&&result.attempt===attempt?result:undefined;
 function cancel(){active.current?.abort();settled.current=identity;setResult({identity,attempt,status:'manual'})}
 function retry(){active.current?.abort();settled.current=null;setAttempt(value=>value+1)}
 return {loading:Boolean(serviceId&&enabled&&!current),resolved:current?.status==='done'||current?.status==='manual',error:enabled?current?.error:undefined,cancel,retry};
}
