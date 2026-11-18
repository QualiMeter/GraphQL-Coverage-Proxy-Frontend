import type {ExecutionQuery,ExecutionStatus} from '../api/testCoverage';
import type {GroupDimension} from '../api/testGroups';
export function selectedGroupValue(query:ExecutionQuery,dimension:GroupDimension){
 const key=dimension==='team'?query.teamKey:query.suiteKey;
 return (dimension==='team'?query.unassignedTeam:query.unassignedSuite)?'unassigned':key!==undefined?`key:${key}`:'';
}
export function withTestGroup(query:ExecutionQuery,dimension:GroupDimension,value:string):ExecutionQuery{
 const next={...query};
 if(dimension==='team'){delete next.teamKey;delete next.unassignedTeam;if(value==='unassigned')next.unassignedTeam=true;else if(value.startsWith('key:'))next.teamKey=value.slice(4)}
 else{delete next.suiteKey;delete next.unassignedSuite;if(value==='unassigned')next.unassignedSuite=true;else if(value.startsWith('key:'))next.suiteKey=value.slice(4)}
 return next;
}
export function executionMatchesGroups(execution:{teamKey?:string|null;suiteKey?:string|null},query:ExecutionQuery){
 return (query.teamKey===undefined||execution.teamKey===query.teamKey)&&(!query.unassignedTeam||execution.teamKey==null)&&(query.suiteKey===undefined||execution.suiteKey===query.suiteKey)&&(!query.unassignedSuite||execution.suiteKey==null);
}
export const executionStatuses:Record<ExecutionStatus,string>={running:'Выполняется',passed:'Успешно',failed:'Ошибка теста',skipped:'Пропущено',interrupted:'Прервано'};
export type TestListView={query:ExecutionQuery;offset:number};
export const defaultTestView:TestListView={query:{},offset:0};
export type TestContext={scope:string;runId:string;snapshotId:string};
export type ContextualTest<T>=TestContext&{value:T};
export function testContextValue<T>(record:ContextualTest<T>|null,context:TestContext|null):T|undefined{return context&&record?.scope===context.scope&&record.runId===context.runId&&record.snapshotId===context.snapshotId?record.value:undefined}
export function testJournalNavigation(context:TestContext,id:string){return {context,executionId:id,requestPath:undefined,operationKey:'',field:''}}
export const testPercent=(value:number|undefined)=>value===undefined?'—':`${value.toLocaleString('ru-RU',{maximumFractionDigits:2})}%`;
