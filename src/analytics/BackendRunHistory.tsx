import {useEffect, useState} from 'react';
import {listRuns, runPageSize, type RunOut, type RunPage} from '../api/runs';
import {runActionError, runStatus, snapshotForRun} from './backendRuns';
import type {SnapshotOption} from './backendSchema';

type Props = {
  serviceId: string;
  snapshots: SnapshotOption[];
  snapshotsReady: boolean;
  selectedId?: string;
  onSelect: (run: RunOut) => void;
};

export function BackendRunHistory({serviceId, snapshots, snapshotsReady, selectedId, onSelect}: Props) {
  const [offset, setOffset] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{offset: number; attempt: number; page?: RunPage; error?: string}>();
  const current = result?.offset === offset && result.attempt === attempt ? result : undefined;
  useEffect(() => {
    const controller = new AbortController();
    void listRuns({serviceId}, offset, controller.signal).then(page => {
      if (!controller.signal.aborted) setResult({offset, attempt, page});
    }).catch(error => {
      if (!controller.signal.aborted) setResult({offset, attempt, error: runActionError(error, 'read')});
    });
    return () => controller.abort();
  }, [serviceId, offset, attempt]);

  return (
    <div className="content-panel backend-run-history">
      <div className="run-history-toolbar">
        <h2>Прогоны сервиса</h2>
        <button type="button" className="run-control" disabled={!current} onClick={() => setAttempt(value => value + 1)}>
          {current?.error ? 'Повторить' : 'Обновить'}
        </button>
      </div>
      {!current ? <div className="run-history-message" role="status">Загружаем прогоны…</div> : current.error ? (
        <div className="run-history-message" role="alert">{current.error}</div>
      ) : current.page && <>
        {current.page.runs.length ? (
          <div className="table-scroll">
            <table className="run-history-table" aria-label="История прогонов сервиса">
              <thead><tr><th>Прогон</th><th>Статус</th><th>Начало</th><th>Завершение</th><th>Снимок</th></tr></thead>
              <tbody>{current.page.runs.map(run => {
                const snapshot = snapshotForRun(run, snapshots);
                const selected = run.id === selectedId;
                return <tr key={run.id} className={selected ? 'selected' : undefined} onClick={snapshot ? () => onSelect(run) : undefined}>
                  <td><button type="button" className="run-history-select" disabled={!snapshot} onClick={event => {event.stopPropagation();onSelect(run)}} aria-pressed={selected}>{run.name}</button></td>
                  <td><span className="run-badge" data-status={run.status}>{runStatus(run.status)}</span></td>
                  <td className="run-history-date">{formatDate(run.startedAt)}</td>
                  <td className="run-history-date">{formatDate(run.finishedAt)}</td>
                  <td className="run-history-snapshot">{snapshot?.name ?? (snapshotsReady ? 'Снимок недоступен' : 'Ожидаем список снимков')}</td>
                </tr>;
              })}</tbody>
            </table>
          </div>
        ) : <div className="run-history-message">{offset ? 'На этой странице нет прогонов.' : 'У сервиса пока нет прогонов. Создайте прогон для выбранного снимка.'}</div>}
        {(offset > 0 || current.page.hasMore) && <div className="run-history-pagination">
          <button type="button" className="run-control" disabled={!offset} onClick={() => setOffset(value => value - runPageSize)}>Назад</button>
          <span>Страница {Math.floor(offset / runPageSize) + 1}</span>
          <button type="button" className="run-control" disabled={!current.page.hasMore} onClick={() => setOffset(value => value + runPageSize)}>Далее</button>
        </div>}
      </>}
    </div>
  );
}

const formatDate = (value: string | null) => value
  ? new Date(value).toLocaleString('ru-RU', {dateStyle: 'short', timeStyle: 'short'})
  : '—';
