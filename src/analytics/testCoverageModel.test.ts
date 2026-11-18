import {describe,it,expect} from 'vitest';
import {testContextValue,testJournalNavigation,defaultTestView,executionStatuses,testPercent,type TestContext} from './testCoverageModel';
import {resourceValue} from './useComparisonResource';
const context:TestContext={scope:'session:service',runId:'run',snapshotId:'snapshot'};
describe('test context and navigation',()=>{
 it('preserves selection and view when returning from the journal to the same run',()=>{expect(testContextValue({...context,value:'execution'},context)).toBe('execution');const value={query:{status:'failed' as const,framework:'pytest' as const,testId:'suite/test'},offset:50};expect(testContextValue({...context,value},context)).toEqual(value)});
 it('never restores execution IDs or filters into a different service/session, snapshot or run',()=>{const record={...context,value:'private-execution'};for(const other of [{...context,scope:'new-session'},{...context,runId:'new-run'},{...context,snapshotId:'new-schema'},null])expect(testContextValue(record,other)).toBeUndefined();expect(testContextValue(null,context)).toBeUndefined()});
 it('opens the existing journal with one execution ID and clears incompatible path/operation/field context',()=>{const nav=testJournalNavigation(context,'attempt-2');expect(nav).toEqual({context,executionId:'attempt-2',requestPath:undefined,operationKey:'',field:''});expect(nav.executionId).not.toBe('operationName')});
 it('does not expose stale resource data after context change or retry',()=>{const result={key:'old-run',attempt:0,data:{id:'old-execution'}};expect(resourceValue('new-run',0,result)).toBeUndefined();expect(resourceValue('old-run',1,result)).toBeUndefined();expect(resourceValue(null,0,result)).toBeUndefined()});
 it('keeps the default query unfiltered and duration/percentage absence neutral',()=>{expect(defaultTestView).toEqual({query:{},offset:0});expect(testPercent(undefined)).toBe('—');expect(testPercent(25)).toBe('25%');expect(Object.keys(executionStatuses)).toEqual(['running','passed','failed','skipped','interrupted'])});
});
