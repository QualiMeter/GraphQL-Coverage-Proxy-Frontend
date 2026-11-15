import {useEffect, useRef, useState, type FormEvent, type ReactNode} from 'react';
import {ApiError} from '../api/client';
import type {RunOut} from '../api/runs';
import {graphqlProxyUrl, runActionError} from './backendRuns';
import './runControls.css';

function RunModal({title, busy, onClose, children}: {
  title: string; busy: boolean; onClose: () => void; children: (close: () => void) => ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!dialog.current?.open) dialog.current?.showModal();
  }, []);
  function close() {
    if (busy) return;
    dialog.current?.close();
    onClose();
  }
  return (
    <dialog ref={dialog} className="create-service-dialog run-dialog" aria-labelledby="run-dialog-title"
      onCancel={event => {event.preventDefault(); close()}}
      onClick={event => {if (event.target === event.currentTarget) close()}}>
      <div className="run-dialog-content">
        <h2 id="run-dialog-title">{title}</h2>
        {children(close)}
      </div>
    </dialog>
  );
}

export function CreateRunDialog({serviceName, snapshotName, onCreate, onClose}: {
  serviceName: string; snapshotName: string; onCreate: (name: string) => Promise<RunOut | null>; onClose: () => void;
}) {
  const [created, setCreated] = useState<RunOut | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copyMessage, setCopyMessage] = useState('');
  const copyingInput = useRef<HTMLInputElement>(null);
  const inFlight = useRef(false);
  const blocked = useRef(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || blocked.current || created) return;
    const name = String(new FormData(event.currentTarget).get('name') ?? '').trim();
    if (!name || [...name].length > 255) {
      setError('Введите название прогона длиной до 255 символов.');
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setError('');
    try {
      const result = await onCreate(name);
      if (result) setCreated(result);
    } catch (error) {
      if (error instanceof ApiError && (error.status === 409 || error.kind !== 'http' || (error.status ?? 0) >= 500)) {
        blocked.current = true;
      }
      setError(runActionError(error, 'create'));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  async function copyId() {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.id);
      setCopyMessage('ID скопирован.');
    } catch {
      copyingInput.current?.focus();
      copyingInput.current?.select();
      setCopyMessage('Автокопирование недоступно. Скопируйте выделенный ID.');
    }
  }

  return (
    <RunModal title={created ? 'Прогон создан' : 'Новый прогон'} busy={busy} onClose={onClose}>
      {close => created ? <>
        <p>Сбор данных открыт. E2E-тесты нужно запустить отдельно.</p>
        <p>Направьте запросы тестов через <code>{graphqlProxyUrl}</code> и передавайте ID в заголовке <code>X-Coverage-Run-Id</code>. Запросы также требуют авторизации proxy.</p>
        <label htmlFor="created-run-id">ID прогона</label>
        <div className="run-copy">
          <input id="created-run-id" value={created.id} readOnly ref={copyingInput}/>
          <button type="button" className="run-control" autoFocus onClick={() => void copyId()}>Копировать</button>
        </div>
        {copyMessage && <p role="status">{copyMessage}</p>}
        <div className="run-dialog-actions"><button type="button" className="run-control" onClick={close}>Закрыть</button></div>
      </> : (
        <form onSubmit={submit} noValidate>
          <dl className="run-dialog-context">
            <div><dt>Сервис</dt><dd>{serviceName}</dd></div>
            <div><dt>Снимок схемы</dt><dd>{snapshotName}</dd></div>
          </dl>
          <label className="run-name-label" htmlFor="new-run-name">Название прогона</label>
          <input id="new-run-name" name="name" placeholder="Например, Регрессия перед релизом"
            aria-describedby={error ? 'new-run-error' : undefined} autoFocus maxLength={255} required disabled={busy}/>
          {error && <p className="form-error" role="alert" id="new-run-error">{error}</p>}
          {busy && <p role="status">Создаём прогон…</p>}
          <div className="run-dialog-actions">
            <button type="button" className="run-control" disabled={busy} onClick={close}>Отмена</button>
            <button type="submit" className="run-control run-control-primary" disabled={busy || blocked.current}>{busy ? 'Создаём…' : 'Создать прогон'}</button>
          </div>
        </form>
      )}
    </RunModal>
  );
}

export function FinishRunDialog({run, onFinish, onClose}: {
  run: RunOut; onFinish: () => Promise<void>; onClose: () => void;
}) {
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [blocked, setBlocked] = useState(false);

  async function finish() {
    if (inFlight.current || blocked) return;
    inFlight.current = true;
    setBusy(true);
    setError('');
    try {
      await onFinish();
      onClose();
    } catch (error) {
      if (error instanceof ApiError && (error.status === 409 || error.kind !== 'http' || (error.status ?? 0) >= 500)) {
        setBlocked(true);
      }
      setError(runActionError(error, 'finish'));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <RunModal title="Завершить прогон" busy={busy} onClose={onClose}>
      {close => <><p>После завершения прогона «{run.name}» сбор новых данных для него остановится.</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      {busy && <p role="status">Завершаем прогон…</p>}
      <div className="run-dialog-actions">
        <button type="button" className="run-control" autoFocus disabled={busy} onClick={close}>Отмена</button>
        <button type="button" className="run-control run-control-finish" disabled={busy || blocked} onClick={() => void finish()}>Завершить прогон</button>
      </div></>}
    </RunModal>
  );
}
