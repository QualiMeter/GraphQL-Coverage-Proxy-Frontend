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
export type OperationErrorFilter='http'|'graphql'|'none';
export type OperationAdvancedFilters={frequency:string;duration:string;minMs:string;field:string;coverage:string;anonymous:boolean};
export const defaultOperationAdvanced:OperationAdvancedFilters={frequency:'',duration:'',minMs:'',field:'',coverage:'',anonymous:false};
export function matchesOperation(operation: OperationOut, query: string, kind: string, field: string, errors: boolean|readonly OperationErrorFilter[],advanced=defaultOperationAdvanced) {
  const threshold=advanced.duration==='custom'?Number(advanced.minMs):Number(advanced.duration||0);
  const validThreshold=advanced.duration!=='custom'||advanced.minMs.trim()!==''&&Number.isFinite(threshold)&&threshold>=0;
  const errorMatch=typeof errors==='boolean'?!errors||operation.httpErrorCount+operation.graphqlErrorCount>0:
    !errors.length||errors.some(error=>error==='http'?operation.httpErrorCount>0:error==='graphql'?operation.graphqlErrorCount>0:operation.httpErrorCount===0&&operation.graphqlErrorCount===0);
  return (operationLabel(operation.operationName)+' '+operation.operationKey).toLowerCase().includes(query.trim().toLowerCase()) &&
    (!kind || operation.operationType === kind) &&
    (!field || operation.fields.some(item => `${item.typeName}.${item.fieldName}` === field)) &&
    errorMatch&&
    (!advanced.frequency||(advanced.frequency==='one'?operation.requestCount===1:advanced.frequency==='few'?operation.requestCount>=2&&operation.requestCount<=4:operation.requestCount>=5))&&
    validThreshold&&
    (!advanced.duration||operation.avgDurationMs!==null&&operation.avgDurationMs>=threshold)&&
    (!advanced.coverage||(advanced.coverage==='full'?operation.requestCount>0&&operation.countedRequestCount===operation.requestCount:advanced.coverage==='partial'?operation.countedRequestCount>0&&operation.countedRequestCount<operation.requestCount:operation.countedRequestCount===0))&&
    (!advanced.anonymous||!operation.operationName);
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
