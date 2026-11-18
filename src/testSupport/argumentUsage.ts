import type {ArgumentUsage,ArgumentUsagePage} from '../api/argumentUsage';
import {evidenceRun,evidenceSnapshot} from './fieldEvidence';
export const argument=(overrides:Partial<ArgumentUsage>={}):ArgumentUsage=>({typeName:'Query',fieldName:'products',argumentName:'limit',argumentType:'Int',hasSchemaDefault:true,providedCount:2,explicitNullCount:1,omittedCount:2,unknownCount:1,mixedCount:1,requestCount:7,...overrides});
export const argumentPage=(overrides:Partial<ArgumentUsagePage>={}):ArgumentUsagePage=>({runId:evidenceRun,snapshotId:evidenceSnapshot,availability:'partial',totalRequests:8,analyzedRequests:7,unavailableRequests:1,total:1,limit:100,offset:0,items:[argument()],...overrides});
