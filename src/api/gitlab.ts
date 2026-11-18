import {ApiError,requestJson} from './client';

// Production LaunchInput / PipelineOut, checked against OpenAPI 2026-11-18.
export type GitlabLaunch={serviceId:string;snapshotId:string;ref:string;name?:string|null};
export type GitlabPipeline={runId:string;pipelineId:number|null;pipelineUrl:string|null;pipelineStatus:string;runStatus:'running'|'completed'|'failed';errorCode:string|null;createdAt:string;finishedAt:string|null;collectionIncomplete:boolean;trackingFinished:boolean};
const object=(v:unknown):v is Record<string,unknown>=>Boolean(v&&typeof v==='object'&&!Array.isArray(v));
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i.test(v);
const date=(v:unknown)=>typeof v==='string'&&Number.isFinite(Date.parse(v));
export function pipelineLink(value:string|null):string|null {
 if(!value||/[\s\\]/.test(value))return null;
 try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password&&!url.search&&!url.hash?url.href:null}catch{return null}
}
export function validBranch(value:string){return value===value.trim()&&[...value].length>0&&[...value].length<=255&&!['.','..'].includes(value)&&[...value].every(c=>c.charCodeAt(0)>=32&&c.charCodeAt(0)!==127)}
export function decodePipeline(data:unknown,runId?:string):GitlabPipeline {
 if(!object(data)||!uuid(data.runId)||(runId!==undefined&&data.runId!==runId)||!(data.pipelineId===null||Number.isSafeInteger(data.pipelineId)&&Number(data.pipelineId)>0)||!(data.pipelineUrl===null||typeof data.pipelineUrl==='string'&&pipelineLink(data.pipelineUrl))||typeof data.pipelineStatus!=='string'||!data.pipelineStatus||!['running','completed','failed'].includes(String(data.runStatus))||!(data.errorCode===null||typeof data.errorCode==='string')||!date(data.createdAt)||!(data.finishedAt===null||date(data.finishedAt))||typeof data.collectionIncomplete!=='boolean'||typeof data.trackingFinished!=='boolean')throw new Error('Expected PipelineOut');
 return data as GitlabPipeline;
}
const statusMessages:Record<number,string>={401:'Войдите в систему для доступа к GitLab CI.',403:'Недостаточно прав на GitLab CI или доступ к сервису. Проверьте сессию.',404:'Сервис или связанный GitLab-ресурс недоступен.',409:'Уже есть активный прогон или незавершённая сверка GitLab. Проверьте историю.',422:'Некорректные параметры запуска. Проверьте ветку и снимок.',502:'Ошибка взаимодействия backend с GitLab.',503:'GitLab-интеграция не настроена либо backend временно недоступен.'};
const codes:Record<string,string>={gitlab_unauthorized:'GitLab отклонил серверную авторизацию.',gitlab_forbidden:'Серверному подключению запрещён доступ к GitLab.',gitlab_not_found:'Ветка или проект не найдены в GitLab.',gitlab_rejected:'GitLab отклонил запуск.',gitlab_network_error:'Backend не получил ответ GitLab из-за сетевой ошибки.',gitlab_unavailable:'GitLab временно недоступен.',gitlab_invalid_response:'GitLab вернул некорректный ответ.',gitlab_destination_unavailable:'Адрес GitLab недоступен для backend.',gitlab_configuration_changed:'Серверная конфигурация GitLab изменилась.',tracking_deadline_exceeded:'Срок сбора истёк. Собранные обращения сохранены; сбор неполон.',operator_confirmed_not_created:'Оператор подтвердил, что pipeline не был создан.'};
export function gitlabCodeMessage(code:string){return codes[code]??`Код GitLab: ${code}`}
export class GitlabApiError extends ApiError {
 constructor(status:number,readonly runId?:string,code?:string,message?:string){super('http',message??(code?gitlabCodeMessage(code):statusMessages[status]??`Ошибка GitLab CI: HTTP ${status}.`),status,undefined,code)}
}
export class GitlabUnknownLaunchError extends ApiError {
 constructor(readonly runId:string,status?:number){super('invalid-response','Ответ запуска неполон. Проверьте созданный прогон без повторного запуска.',status)}
}
export function gitlabErrorRunId(error:unknown){return error instanceof GitlabApiError||error instanceof GitlabUnknownLaunchError?error.runId:undefined}
export function decodeGitlabError(data:unknown,status:number){
 const detail=object(data)&&object(data.detail)?data.detail:object(data)?data:{};
 const code=typeof detail.code==='string'&&/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(detail.code)?detail.code:undefined;
 const runId=uuid(detail.runId)?detail.runId:undefined;
 // Do not render arbitrary upstream text or credentials from error bodies.
 const message=object(data)&&data.detail==='GitLab integration is not configured for this service'?'GitLab-интеграция не настроена для выбранного сервиса.':object(data)&&typeof data.detail==='string'&&data.detail.startsWith('GitLab launch storage unavailable')?'Хранилище запуска недоступно. Проверьте историю перед новым запуском.':undefined;
 return new GitlabApiError(status,runId,code,message);
}
export function gitlabErrorMessage(error:unknown){return error instanceof Error?error.message:'Не удалось получить данные GitLab CI.'}
export function launchNeedsHistory(error:unknown){return !(error instanceof ApiError)||error.kind!=='http'||(error.status??0)>=500||error.status===409}
export function launchGitlab(input:GitlabLaunch,csrfToken:string,signal?:AbortSignal){
 if(!uuid(input.serviceId)||!uuid(input.snapshotId)||!validBranch(input.ref)||input.name!==undefined&&input.name!==null&&(!input.name.trim()||[...input.name].length>255))throw new Error('Проверьте сервис, снимок, ветку и название прогона.');
 let receivedRunId:string|undefined;
 return requestJson('/api/runs/gitlab',(data,response)=>{if(object(data)&&uuid(data.runId))receivedRunId=data.runId;if(response.status!==202)throw new Error('Expected 202 Accepted');return decodePipeline(data)},{method:'POST',body:input,csrfToken,signal,decodeError:decodeGitlabError}).catch(error=>{if(receivedRunId&&error instanceof ApiError&&error.kind==='invalid-response')throw new GitlabUnknownLaunchError(receivedRunId,error.status);throw error});
}
export function gitlabBranches(serviceId:string,page:number,signal?:AbortSignal){
 if(!Number.isInteger(page)||page<1||page>10000)throw new Error('Некорректная страница веток.');
 return requestJson(`/api/services/${encodeURIComponent(serviceId)}/gitlab/branches?page=${page}`,data=>{if(!Array.isArray(data)||data.length>100||!data.every(v=>typeof v==='string'&&validBranch(v)))throw new Error('Expected branch names');return data as string[]},{signal,decodeError:decodeGitlabError});
}
export async function getGitlabPipeline(runId:string,signal?:AbortSignal):Promise<GitlabPipeline|null>{
 try{return await requestJson(`/api/runs/${encodeURIComponent(runId)}/gitlab`,data=>decodePipeline(data,runId),{signal,decodeError:decodeGitlabError})}catch(error){if(error instanceof ApiError&&error.status===404)return null;throw error}
}
