import {ApiError} from '../api/client';
import type {RunOut} from '../api/runs';

export type RunSelection = {scope: string; run: RunOut};

export function selectedRun(selection: RunSelection | null, scope: string, snapshotId: string | null) {
  return selection?.scope === scope && selection.run.snapshotId === snapshotId ? selection.run : null;
}

export function snapshotForRun<T extends {id: string}>(run: RunOut, snapshots: readonly T[]) {
  return snapshots.find(snapshot => snapshot.id === run.snapshotId);
}

export function runStatus(status: string) {
  switch (status) {
    case 'active':
    case 'running': return 'Активен';
    case 'completed': return 'Завершён';
    case 'failed': return 'Ошибка';
    default: return status || 'Неизвестен';
  }
}

export function runActionError(error: unknown, action: 'create' | 'finish' | 'read'): string {
  if (!(error instanceof ApiError)) return 'Не удалось выполнить действие с прогоном.';
  switch (error.status) {
    case 401: return 'Для доступа к прогонам войдите в систему.';
    case 403: return 'Недостаточно прав для этого действия с прогоном.';
    case 404: return 'Прогон, снимок или сервис недоступен.';
    case 409: return action === 'create'
      ? 'Для снимка уже есть активный прогон. Выберите его в истории.'
      : 'Статус прогона изменился. Откройте историю, чтобы выбрать актуальный прогон.';
    case 422: return 'Проверьте название прогона и выбранный снимок.';
  }
  if (action !== 'read' && (error.kind !== 'http' || (error.status ?? 0) >= 500)) {
    return 'Не удалось подтвердить результат. Проверьте историю перед повторной попыткой.';
  }
  return error.message;
}

export const graphqlProxyUrl = 'https://graphql.rebyte.fun/graphql';
