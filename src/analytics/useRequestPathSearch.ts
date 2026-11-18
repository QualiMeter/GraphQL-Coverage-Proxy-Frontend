import {useEffect,useRef,useState} from 'react';
import {getJournal,getRequestDetail} from '../api/runAnalytics';
import {getSchemaSdl} from '../api/schemas';
import type {SchemaCoordinate} from '../api/runPaths';
import {PathSearchSession,type PathSearchState} from './pathSearchSession';
export function useRequestPathSearch({runId,snapshotId,scope,path,enabled}:{runId:string;snapshotId?:string;scope:string;path?:readonly SchemaCoordinate[];enabled:boolean}){
 const key=enabled&&path?.length&&snapshotId?JSON.stringify([scope,runId,snapshotId,path]):null;
 const instance=useRef<{key:string;session:PathSearchSession}|null>(null);
 const [result,setResult]=useState<{key:string;value:PathSearchState}>();
 useEffect(()=>{
  if(!key||!path?.length||!snapshotId)return;
  const terminal=path[path.length-1];
  const session=new PathSearchSession({runId,path,loadSdl:signal=>getSchemaSdl(snapshotId,signal),loadPage:(offset,signal)=>getJournal(runId,{typeName:terminal.typeName,fieldName:terminal.fieldName,sortBy:'createdAt',sortOrder:'asc'},offset,signal,{limit:100,includeTotal:true}),loadDetail:(id,signal)=>getRequestDetail(runId,id,signal),onUpdate:value=>setResult({key,value})});
  instance.current={key,session};void session.next();
  return ()=>{session.dispose();if(instance.current?.session===session)instance.current=null};
  // Path content is included in key; identity changes must not restart a scan.
 },[key]);
 const current=key&&result?.key===key?result.value:undefined;
 const session=()=>instance.current?.key===key?instance.current.session:undefined;
 return {state:current,next:()=>void session()?.next(),cancel:()=>session()?.cancel(),getDetail:(id:string)=>session()?.getDetail(id)};
}
