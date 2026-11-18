// Contracts from production OpenAPI and backend main, 2026-11-18.
export type RunComparisonRequest = {
  runIds: (string)[];
  baselineRunId: string;
  targetRunId?: (string | null);
  fields?: ComparisonFieldPage;
  types?: ComparisonTypePage;
};

export type ComparisonFieldPage = {
  filter?: "all" | "changed" | "newlyCovered" | "noLongerCovered" | "stillCovered" | "stillUncovered" | "alwaysCovered" | "neverCovered" | "intermittentlyCovered";
  limit?: number;
  offset?: number;
};

export type ComparisonTypePage = {
  limit?: number;
  offset?: number;
};

export type RunComparisonResponse = {
  snapshotId: string;
  schemaHash: string;
  generatedAt: string;
  baselineRunId: string;
  targetRunId: string;
  runs: (RunMetricOut)[];
  comparison: ComparisonDeltaOut;
  fieldCategories: Record<string, number>;
  fields: ComparedFieldPageOut;
  types: ComparedTypePageOut;
};

export type RunMetricOut = {
  runId: string;
  name: string;
  status: "completed";
  startedAt: string;
  finishedAt: (string | null);
  totalFields: number;
  coveredFields: number;
  coveragePercent: number;
  totalRequests: number;
  countedRequests: number;
  uniqueOperations: number;
  queryRequests: number;
  mutationRequests: number;
  subscriptionRequests: number;
  httpErrorCount: number;
  graphqlErrorCount: number;
  analysisStatusCounts: AnalysisStatusCounts;
  avgDurationMs: (number | null);
  p95DurationMs: (number | null);
};

export type AnalysisStatusCounts = {
  success: number;
  parseError: number;
  validationError: number;
  unsupported: number;
  internalError: number;
};

export type ComparisonDeltaOut = {
  percentagePointDelta: number;
  coveredFieldsDelta: number;
  requestsDelta: number;
  countedRequestsDelta: number;
  uniqueOperationsDelta: number;
  httpErrorCountDelta: number;
  graphqlErrorCountDelta: number;
  avgDurationDeltaMs: (number | null);
  p95DurationDeltaMs: (number | null);
  adjacentCoverageDeltasPp: (Record<string, unknown>)[];
  newlyCovered: number;
  noLongerCovered: number;
  stillCovered: number;
  stillUncovered: number;
  alwaysCovered: number;
  neverCovered: number;
  intermittentlyCovered: number;
};

export type ComparedFieldPageOut = {
  total: number;
  items: (ComparedFieldOut)[];
};

export type ComparedFieldOut = {
  typeName: string;
  fieldName: string;
  hitsByRun: (RunFieldHitsOut)[];
  coveredRunCount: number;
  coverageFrequencyPercent: number;
  coverageTransitions: number;
  baselineToTarget: "newlyCovered" | "noLongerCovered" | "stillCovered" | "stillUncovered";
  stability: "alwaysCovered" | "neverCovered" | "intermittentlyCovered";
  firstCoveredRunId: (string | null);
  lastCoveredRunId: (string | null);
};

export type RunFieldHitsOut = {
  runId: string;
  hits: number;
};

export type ComparedTypePageOut = {
  total: number;
  items: (ComparedTypeOut)[];
};

export type ComparedTypeOut = {
  typeName: string;
  rootRole: ("query" | "mutation" | "subscription" | null);
  totalFields: number;
  runs: (TypeRunCoverageOut)[];
};

export type TypeRunCoverageOut = {
  runId: string;
  coveredFields: number;
  coveragePercent: number;
};

export type FieldEvidencePage = {
  runId: string;
  snapshotId: string;
  requestCount: number;
  selectionUnavailableRequestCount: number;
  evidenceUnavailableRequestCount: number;
  total: number;
  limit: number;
  offset: number;
  fields: (FieldEvidenceOut)[];
};

export type FieldEvidenceOut = {
  fieldId: string;
  typeName: string;
  fieldName: string;
  selectedRequestCount: number;
  selectedHits: number;
  observedHits: number;
  notObservedCount: number;
  indeterminateCount: number;
  unavailableCount: number;
};

export type ExecutionOut = {
  teamKey?: string | null;
  suiteKey?: string | null;
  id: string;
  runId: string;
  testId: string;
  name: string;
  framework: string;
  attempt: number;
  status: "running" | "passed" | "failed" | "skipped" | "interrupted";
  startedAt: string;
  finishedAt: (string | null);
  durationMs: (number | null);
  failureCode: ("test_failed" | "assertion_failed" | "setup_failed" | "teardown_failed" | "timeout" | "runner_interrupted" | null);
  inFlightRequests: number;
  collectionStatus: "running" | "completed" | "failed";
  resultMissing: boolean;
  requestCount?: number;
  countedRequestCount?: number;
  selectedFieldCount?: number;
  coveredFieldCount?: number;
  observedFieldCount?: number;
  totalFields?: number;
  coveragePercent?: number;
};

export type ExecutionFieldOut = {
  typeName: string;
  fieldName: string;
  kind: string;
  selectedRequestCount: number;
  hits: number;
  observedCount: number;
  notObservedCount: number;
  indeterminateCount: number;
  unavailableCount: number;
};

export type RequestDetailOut = {
  testExecutionId?: (string | null);
  operationKey?: (string | null);
  id: string;
  runId: string;
  operationName: (string | null);
  operationType: (string | null);
  httpMethod: string;
  httpStatus: (number | null);
  analysisStatus: string;
  responseHasData: (boolean | null);
  graphqlHasErrors: (boolean | null);
  durationMs: (number | null);
  errorCode: (string | null);
  createdAt: string;
  fieldEvidenceVersion?: (1 | null);
  graphqlErrorCount?: (number | null);
  graphqlErrorDetailsAvailability?: "sanitized" | "truncated" | "unavailable";
  graphqlErrorDetails?: ((GraphQLErrorDetailOut)[] | null);
  safeGraphqlDocument?: (string | null);
  documentAvailability?: "available" | "redacted" | "unavailable";
  countedInCoverage: boolean;
  selectedFields: (SelectedFieldOut)[];
};

export type GraphQLErrorDetailOut = {
  code?: (string | null);
  path?: (((string | number))[] | null);
  locations?: (GraphQLErrorLocationOut)[];
  safeMessage?: (string | null);
};

export type GraphQLErrorLocationOut = {
  line: number;
  column: number;
};

export type SelectedFieldOut = {
  typeName: string;
  fieldName: string;
  returnType: (string | null);
};
