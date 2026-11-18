import type {GraphQLSchema} from 'graphql';
import {ApiError} from '../api/client';
import type {RequestOut,RequestDetail} from '../api/runAnalytics';
import type {SchemaCoordinate} from '../api/runPaths';
import {buildPathSchema,matchRequestPath,type PathMatch} from './requestPathAst';

export type PathCandidates={rows:RequestOut[];more:boolean;total?:number};
export type PathSearchState={rows:RequestOut[];unverified:{row:RequestOut;reason:string}[];viewed:number;notMatched:number;remaining:number|null;more:boolean;running:boolean;paused:boolean;error?:Error;schemaIssue?:string};
export class PathSearchSession {
 private controller?:AbortController;
 private generation=0;
 private disposed=false;
 private schema:GraphQLSchema|null|undefined;
 private offset=0;
 private page:PathCandidates|undefined;
 private seen=new Set<string>();
 private cache=new Map<string,RequestDetail>();
 private decisions=new Map<string,PathMatch>();
 private total:number|undefined;
 private state:PathSearchState={rows:[],unverified:[],viewed:0,notMatched:0,remaining:null,more:true,running:false,paused:false};
 constructor(private options:{runId:string;path:readonly SchemaCoordinate[];loadSdl:(signal:AbortSignal)=>Promise<string>;loadPage:(offset:number,signal:AbortSignal)=>Promise<PathCandidates>;loadDetail:(id:string,signal:AbortSignal)=>Promise<RequestDetail>;onUpdate:(state:PathSearchState)=>void}){}
 get snapshot(){return {...this.state,rows:[...this.state.rows],unverified:[...this.state.unverified]}}
 getDetail(id:string){return this.cache.get(id)}
 private publish(){if(!this.disposed){this.state.remaining=this.total===undefined?(this.state.more?null:0):Math.max(0,this.total-this.state.viewed);this.options.onUpdate(this.snapshot)}}
 cancel(){this.generation++;this.controller?.abort();this.state.running=false;this.state.paused=this.state.more;this.publish()}
 dispose(){this.disposed=true;this.generation++;this.controller?.abort();this.cache.clear();this.decisions.clear()}
 async next(){
  if(this.disposed||this.state.running||!this.state.more)return;
  const generation=++this.generation,controller=new AbortController();this.controller=controller;
  const current=()=>!this.disposed&&!controller.signal.aborted&&generation===this.generation;
  this.state.running=true;this.state.paused=false;this.state.error=undefined;this.publish();
  try{
   if(this.schema===undefined){
    const sdl=await this.options.loadSdl(controller.signal);if(!current())return;
    try{this.schema=buildPathSchema(sdl)}catch{this.schema=null;this.state.schemaIssue='SDL не образует корректную схему. Документы этой порции отмечены непроверенными.'}
   }
   if(!this.page){const page=await this.options.loadPage(this.offset,controller.signal);if(!current())return;if(page.rows.length>100)throw new Error('Сервер вернул больше 100 кандидатов в одной порции.');if(page.rows.some(r=>r.runId!==this.options.runId))throw new Error('Получены кандидаты другого прогона.');this.page=page;if(page.total!==undefined)this.total=page.total}
   const page=this.page,todo=[...new Map(page.rows.filter(row=>!this.seen.has(row.id)).map(row=>[row.id,row])).values()];let cursor=0,fatal:Error|undefined;
   const worker=async()=>{
    while(current()&&!fatal&&cursor<todo.length){
     const row=todo[cursor++];let decision:PathMatch;
     try{
      let detail=this.cache.get(row.id);
      if(!detail){detail=await this.options.loadDetail(row.id,controller.signal);if(!current())return;if(detail.id!==row.id||detail.runId!==this.options.runId)throw new Error('Подробности обращения относятся к другому контексту.');this.cache.set(row.id,detail);while(this.cache.size>200||[...this.cache.values()].reduce((n,r)=>n+(r.safeGraphqlDocument?.length??0),0)>2000000)this.cache.delete(this.cache.keys().next().value!)}
      const key=JSON.stringify([detail.operationName,detail.operationType,detail.documentAvailability,detail.safeGraphqlDocument]);
      decision=this.decisions.get(key)??matchRequestPath(this.schema??null,detail,this.options.path);
      if(key.length<=64000){this.decisions.set(key,decision);if(this.decisions.size>32)this.decisions.delete(this.decisions.keys().next().value!)}
     }catch(error){
      if(!current())return;
      if(error instanceof ApiError&&(error.status===401||error.status===403)){fatal=error;return}
      decision={state:'unverified',reason:error instanceof Error?error.message:'Подробности недоступны.'};
     }
     if(!current()||this.seen.has(row.id))continue;
     this.seen.add(row.id);this.state.viewed++;
     if(decision.state==='match')this.state.rows.push(row);
     else if(decision.state==='unverified')this.state.unverified.push({row,reason:decision.reason??'Недостаточно данных.'});
     else this.state.notMatched++;
     this.publish();
    }
   };
   await Promise.all(Array.from({length:Math.min(4,todo.length)},worker));
   if(!current())return;
   if(fatal)throw fatal;
   this.offset+=page.rows.length;this.state.more=page.more&&page.rows.length>0;this.page=undefined;
  }catch(error){if(!current())return;this.state.error=error instanceof Error?error:new Error('Поиск не выполнен.')}
  if(current()){this.state.running=false;this.publish()}
 }
}
