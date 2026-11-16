import {useCallback, useRef, useState} from 'react';
import {getRunStats} from '../api/runAnalytics';
import type {RunOut} from '../api/runs';
import type {ApiError} from '../api/client';
import {analyticsError} from './runAnalyticsModel';
import {useBackendRead} from './useBackendRead';
import {coverageErrorMessage, useRunCoverage} from './useRunCoverage';

export function runAnalyticsErrors(coverageError: ApiError | null, statsError?: Error, coverageNote = '') {
  return [
    ...(coverageError ? [`Покрытие схемы — ${coverageErrorMessage(coverageError)}${coverageNote}`] : []),
    ...(statsError ? [`Статистика обращений — ${analyticsError(statsError)}`] : []),
  ];
}

export function useRunAnalytics(run: RunOut | null, schemaId: string | null, context: string) {
  const [revision, setRevision] = useState(0);
  const runId = run?.id ?? null;
  const scope = run ? JSON.stringify([context, run.id, run.status]) : null;
  const request = scope ? JSON.stringify([scope, revision]) : null;
  const loadStats = useCallback((signal: AbortSignal) => getRunStats(runId!, signal), [runId]);
  const stats = useBackendRead(request, loadStats);
  const coverage = useRunCoverage(runId, schemaId, context, revision, run?.status);
  const loading = stats.loading || coverage.loading;
  const lastRefresh = useRef<string | null>(null);

  function refresh() {
    if (!request || loading || lastRefresh.current === request) return false;
    lastRefresh.current = request;
    setRevision(value => value + 1);
    return true;
  }

  return {coverage, stats, scope, revision, refresh};
}
