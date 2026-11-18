export type RunCi={provider:'gitlab';projectId:number;branch:string;commitSha:string|null;environment:string|null;pipelineId:number;pipelineUrl:string|null;pipelineStatus:string;jobsSyncedAt:string|null;jobsFinalized:boolean};
const object=(value:unknown):value is Record<string,unknown>=>Boolean(value)&&typeof value==='object'&&!Array.isArray(value);
const id=(value:unknown):value is number=>typeof value==='number'&&Number.isSafeInteger(value)&&value>0;
const date=(value:unknown)=>typeof value==='string'&&Number.isFinite(Date.parse(value));
const nullableDate=(value:unknown)=>value===null||date(value);
export function isRunCi(value:unknown):value is RunCi{
 return object(value)&&value.provider==='gitlab'&&id(value.projectId)&&typeof value.branch==='string'&&(value.commitSha===null||typeof value.commitSha==='string'&&/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(value.commitSha))&&(value.environment===null||typeof value.environment==='string')&&id(value.pipelineId)&&(value.pipelineUrl===null||typeof value.pipelineUrl==='string')&&typeof value.pipelineStatus==='string'&&nullableDate(value.jobsSyncedAt)&&typeof value.jobsFinalized==='boolean';
}
