import {useEffect, useRef, useState, type FormEvent} from 'react';
import {analyticsError} from './runAnalyticsModel';
import './settingsDialog.css';

type Props = {
  name: string;
  currentName: string;
  onSave: (name: string | null) => Promise<void>;
  onClose: () => void;
};

export function SnapshotNameDialog({name, currentName, onSave, onClose}: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState(name);
  const [error, setError] = useState('');
  const trimmed = draft.trim();
  const canSave = trimmed.length > 0 && trimmed !== name;

  useEffect(() => {
    if (!dialog.current?.open) dialog.current?.showModal();
  }, []);

  function close() {
    if (pending.current) return;
    dialog.current?.close();
    onClose();
  }

  async function save(next: string | null) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      await onSave(next);
      dialog.current?.close();
      onClose();
    } catch (failure) {
      setError(failure instanceof Error ? analyticsError(failure) : 'Не удалось сохранить имя снимка.');
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (canSave) void save(trimmed);
  }

  return <dialog ref={dialog} className="create-service-dialog service-create-dialog settings-dialog snapshot-name-dialog"
    aria-labelledby="snapshot-name-title" onCancel={event => {event.preventDefault(); close()}}
    onClick={event => {if (event.target === event.currentTarget) close()}}>
    <form onSubmit={submit} aria-busy={busy}>
      <h2 id="snapshot-name-title">Переименовать снимок</h2>
      <dl className="settings-context">
        <dt>Текущее название</dt>
        <dd><strong>{currentName}</strong></dd>
        {!name && <dd className="settings-hint">Название сформировано автоматически.</dd>}
      </dl>
      <fieldset disabled={busy}>
        <label htmlFor="snapshot-display-name">Название снимка</label>
        <input id="snapshot-display-name" name="name" value={draft} onChange={event => setDraft(event.target.value)}
          required maxLength={255} autoFocus/>
        {name && <button className="settings-text-action" type="button" onClick={() => void save(null)}>
          Восстановить исходное название
        </button>}
      </fieldset>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="create-service-actions">
        <button type="button" disabled={busy} onClick={close}>Отмена</button>
        <button type="submit" className="primary" disabled={busy || !canSave}>{busy ? 'Сохраняем…' : 'Сохранить'}</button>
      </div>
    </form>
  </dialog>;
}
