import {useEffect, useState} from 'react';
import {ApiError} from '../api/client';
import {getRunCoverage, type RunCoverageGraph} from '../api/schemas';

type CoverageResult = {
  scope: string;
  request: string;
  data: RunCoverageGraph | null;
  error: ApiError | null;
};

export function coverageForRequest(result: CoverageResult | undefined, scope: string | null, request: string) {
  const current = scope !== null && result?.scope === scope ? result : undefined;
  const settled = current?.request === request;
  return {
    data: current?.data ?? null,
    loading: scope !== null && !settled,
    error: settled ? current?.error ?? null : null,
  };
}

export function coverageErrorMessage(error: ApiError) {
  if (error.status === 404) return 'Прогон не найден или недоступен для просмотра покрытия.';
  return error.message;
}

export function useRunCoverage(runId: string | null, schemaId: string | null, context: string, revision: number, status?: string) {
  const scope = runId && schemaId ? JSON.stringify([context, runId, schemaId]) : null;
  const [result, setResult] = useState<CoverageResult>();
  const request = JSON.stringify([status, revision]);

  useEffect(() => {
    if (!scope || !runId || !schemaId) return;
    const controller = new AbortController();
    void getRunCoverage(runId, schemaId, controller.signal)
      .then(data => {
        if (!controller.signal.aborted) setResult({scope, request, data, error: null});
      })
      .catch((error: ApiError) => {
        if (controller.signal.aborted) return;
        setResult(previous => coverageFailure(previous, scope, request, error));
      });
    return () => controller.abort();
  }, [scope, runId, schemaId, request]);

  return coverageForRequest(result, scope, request);
}

export function coverageFailure(previous: CoverageResult | undefined, scope: string, request: string, error: ApiError): CoverageResult {
  const temporary = error.kind === 'network' || (error.status ?? 0) >= 500;
  return {scope, request, data: temporary && previous?.scope === scope ? previous.data : null, error};
}
