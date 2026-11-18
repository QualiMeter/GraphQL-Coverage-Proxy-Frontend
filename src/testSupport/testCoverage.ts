import type {ExecutionOut,TestCoverageSummary} from '../api/testCoverage';
export const testRunId='00000000-0000-0000-0000-000000000001';
export const executionId='00000000-0000-0000-0000-000000000002';
export const retryId='00000000-0000-0000-0000-000000000003';
export const execution=(id=executionId,attempt=1):ExecutionOut=>({id,runId:testRunId,testId:'suite/product-price',name:'Product price E2E',framework:'playwright',attempt,status:'failed',startedAt:'2026-11-18T00:00:00Z',finishedAt:'2026-11-18T00:01:00Z',durationMs:60000,failureCode:'assertion_failed',inFlightRequests:0,collectionStatus:'completed',resultMissing:false,requestCount:7,countedRequestCount:6,selectedFieldCount:8,coveredFieldCount:5,observedFieldCount:4,totalFields:20,coveragePercent:25});
export const testingSummary:TestCoverageSummary={runId:testRunId,collectionStatus:'completed',totalTests:1,totalExecutions:3,statusCounts:{passed:1,failed:1,skipped:0,interrupted:1,running:0},missingResults:1,inFlightRequests:0,totalRequests:12,attributedRequests:9,unattributedRequests:3};
