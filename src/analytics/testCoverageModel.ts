import type {ExecutionQuery,ExecutionStatus} from '../api/testCoverage';
export const executionStatuses:Record<ExecutionStatus,string>={running:'Выполняется',passed:'Успешно',failed:'Ошибка теста',skipped:'Пропущено',interrupted:'Прервано'};
export type TestListView={query:ExecutionQuery;offset:number};
export const defaultTestView:TestListView={query:{},offset:0};
export type TestContext={scope:string;runId:string;snapshotId:string};
export type ContextualTest<T>=TestContext&{value:T};
export function testContextValue<T>(record:ContextualTest<T>|null,context:TestContext|null):T|undefined{return context&&record?.scope===context.scope&&record.runId===context.runId&&record.snapshotId===context.snapshotId?record.value:undefined}
export function testJournalNavigation(context:TestContext,id:string){return {context,executionId:id,requestPath:undefined,operationKey:'',field:''}}
export const testPercent=(value:number|undefined)=>value===undefined?'—':`${value.toLocaleString('ru-RU',{maximumFractionDigits:2})}%`;
