import type {FieldEvidenceOut,FieldEvidencePage} from '../api/fieldEvidence';
export const evidenceRun='10000000-0000-4000-8000-000000000001';
export const evidenceSnapshot='10000000-0000-4000-8000-000000000002';
export const evidenceField=(overrides:Partial<FieldEvidenceOut>={}):FieldEvidenceOut=>({fieldId:'10000000-0000-4000-8000-000000000003',typeName:'Product',fieldName:'price',selectedRequestCount:1,selectedHits:0,observedHits:1,notObservedCount:0,indeterminateCount:0,unavailableCount:0,...overrides});
export const evidencePage=(overrides:Partial<FieldEvidencePage>={}):FieldEvidencePage=>({runId:evidenceRun,snapshotId:evidenceSnapshot,requestCount:1,selectionUnavailableRequestCount:0,evidenceUnavailableRequestCount:0,total:1,limit:100,offset:0,fields:[evidenceField()],...overrides});
