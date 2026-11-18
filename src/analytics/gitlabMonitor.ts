import {ApiError} from '../api/client';
import type {GitlabPipeline} from '../api/gitlab';

type Update={data:GitlabPipeline|null;error?:Error};
export function mayManuallyFinish(checked:boolean,data:GitlabPipeline|null|undefined,error?:Error){return checked&&data===null&&!error}
// One serialized GET loop for the selected run. No launch calls or global timers.
export function startGitlabMonitor({load,onResult,onUpdate,seed,expectedManaged=false,interval=10000}:{load:(signal:AbortSignal)=>Promise<GitlabPipeline|null>;onResult:(result:Update)=>void;onUpdate:(data:GitlabPipeline,signal:AbortSignal)=>void;seed?:GitlabPipeline;expectedManaged?:boolean;interval?:number}){
 const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;let known=seed;
 async function check(){
  let again=false;
  try{
   const data=await load(controller.signal);
   if(controller.signal.aborted)return;
   if(data===null&&(known||expectedManaged))throw new ApiError('http','Связанные GitLab-метаданные недоступны. Проверьте права и повторите чтение.',404);
   if(data)known=data;
   onResult({data});
   if(data){onUpdate(data,controller.signal);again=!data.trackingFinished}
  }catch(error){
   if(controller.signal.aborted)return;
   const failure=error instanceof Error?error:new Error('Не удалось прочитать GitLab-статус.');
   onResult({data:known??null,error:failure});
   again=Boolean(known?!known.trackingFinished:expectedManaged)&&!(failure instanceof ApiError&&(failure.status===401||failure.status===403));
  }
  if(again&&!controller.signal.aborted)timer=setTimeout(()=>void check(),interval);
 }
 void check();
 return ()=>{controller.abort();if(timer!==undefined)clearTimeout(timer)};
}
