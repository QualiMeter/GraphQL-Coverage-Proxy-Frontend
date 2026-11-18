import type {RunOut} from '../api/runs';
import type {RunCi,GitlabJob,GitlabJobPage} from '../api/gitlabHistory';
export const ciService='10000000-0000-4000-8000-000000000001',ciSnapshot='10000000-0000-4000-8000-000000000002';
export const ciRunId='10000000-0000-4000-8000-000000000003';
export const ci=(overrides:Partial<RunCi>={}):RunCi=>({provider:'gitlab',projectId:24,branch:'main',commitSha:'a'.repeat(40),environment:'qa/staging',pipelineId:1428,pipelineUrl:'https://gitlab.example.com/group/project/-/pipelines/1428',pipelineStatus:'failed',jobsSyncedAt:null,jobsFinalized:false,...overrides});
export const ciRun=(overrides:Partial<RunOut>={}):RunOut=>({id:ciRunId,snapshotId:ciSnapshot,name:'Smoke tests',status:'completed',startedAt:'2026-11-19T00:00:00Z',finishedAt:'2026-11-19T00:02:00Z',ci:ci(),...overrides});
export const job=(jobId=42):GitlabJob=>({jobId,name:'e2e',stage:'test',status:'failed',url:`https://gitlab.example.com/group/project/-/jobs/${jobId}`,createdAt:'2026-11-19T00:00:00Z',startedAt:'2026-11-19T00:00:10Z',finishedAt:'2026-11-19T00:01:10Z'});
export const jobPage=(overrides:Partial<GitlabJobPage>={}):GitlabJobPage=>({runId:ciRunId,pipelineId:1428,jobsSyncedAt:null,jobsFinalized:false,total:2,jobs:[job(43),job(42)],...overrides});
