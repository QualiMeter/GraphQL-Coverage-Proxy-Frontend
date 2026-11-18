import {useEffect,useRef,useState} from 'react';
import {getGitlabPipeline,type GitlabPipeline} from '../api/gitlab';
import {startGitlabMonitor,mayManuallyFinish} from './gitlabMonitor';

export function useGitlabPipeline(runId:string|null,scope:string,onUpdate:(data:GitlabPipeline,signal:AbortSignal)=>void,seed?:GitlabPipeline,expectedManaged=false){
 const key=runId?JSON.stringify([scope,runId]):null;
 const callback=useRef(onUpdate);callback.current=onUpdate;
 const initial=seed?.runId===runId?seed:undefined;
 const seedRef=useRef(initial);seedRef.current=initial;
 const [attempt,setAttempt]=useState(0);
 const [result,setResult]=useState<{key:string;attempt:number;data:GitlabPipeline|null;error?:Error}>();
 const known=result?.key===key?result.data??initial:initial;
 seedRef.current=known;
 useEffect(()=>{
  if(key===null||!runId)return;
  return startGitlabMonitor({load:signal=>getGitlabPipeline(runId,signal),seed:seedRef.current,expectedManaged,onResult:value=>setResult({key,attempt,...value}),onUpdate:(data,signal)=>callback.current(data,signal)});
 },[key,runId,attempt,expectedManaged]);
 const current=result?.key===key&&result.attempt===attempt?result:undefined;
 const data=current?.data??known;
 return {data,error:current?.error,loading:key!==null&&!current,canFinish:mayManuallyFinish(Boolean(current),current?.data,current?.error),retry:()=>setAttempt(v=>v+1)};
}
