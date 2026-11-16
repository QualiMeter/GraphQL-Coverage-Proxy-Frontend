import {ApiError} from '../api/client';
import type {OperationOut, RunStats} from '../api/runAnalytics';

export function operationLabel(name: string | null) {return name || 'Без имени'}
const durationNumber = new Intl.NumberFormat('ru-RU', {maximumFractionDigits: 2});
export function millisValue(value: number) {return durationNumber.format(value)}
export function millis(value: number | null | undefined) {return value == null ? '—' : `${millisValue(value)} мс`}
export function analysisErrors(stats: RunStats) {
  const counts = stats.analysisStatusCounts;
  return counts ? counts.parseError + counts.validationError + counts.internalError : null;
}
export function matchesOperation(operation: OperationOut, query: string, kind: string, field: string, errors: boolean) {
  return operationLabel(operation.operationName).toLowerCase().includes(query.trim().toLowerCase()) &&
    (!kind || operation.operationType === kind) &&
    (!field || operation.fields.some(item => `${item.typeName}.${item.fieldName}` === field)) &&
    (!errors || operation.httpErrorCount + operation.graphqlErrorCount > 0);
}
export function mayReadJournal(role?: string) {return role === 'analyst' || role === 'operator' || role === 'admin'}

export function analyticsError(error: Error) {
  if (error instanceof ApiError) {
    if (error.status === 401) return 'Войдите в систему для просмотра данных.';
    if (error.status === 403) return 'Недостаточно прав для просмотра данных.';
    if (error.status === 404) return 'Данные не найдены или доступ к ним ограничен.';
  }
  return error.message;
}
