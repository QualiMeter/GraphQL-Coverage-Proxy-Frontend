import {useEffect, useRef, useState, type FormEvent} from 'react';
import type {CatalogService} from './serviceCatalog';
import {readSchemaFile, schemaImportError, validateSchemaSdl, type SnapshotImport} from './schemaImport';
import './snapshotImport.css';

type Props = {
  local: boolean;
  service: CatalogService | null;
  onClose: () => void;
  onImport: (input: SnapshotImport) => Promise<void>;
};

type Selection =
  | {kind: 'validating'; name: string}
  | {kind: 'invalid'; name: string; error: string}
  | {kind: 'ready'; name: string; sdl: string};

const methods = [
  {id: 'sdl', label: 'SDL-файл'},
  {id: 'introspection', label: 'Introspection'},
] as const;

export function SnapshotDialog({local, service, onClose, onImport}: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const validation = useRef(0);
  const submitting = useRef(false);
  const [method, setMethod] = useState<SnapshotImport['method']>('sdl');
  const [selection, setSelection] = useState<Selection | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const isSdl = method === 'sdl';
  const canSubmit = isSdl ? selection?.kind === 'ready' : !local;

  useEffect(() => {
    if (!dialog.current?.open) dialog.current?.showModal();
    return () => {validation.current += 1};
  }, []);

  function close() {
    if (submitting.current) return;
    dialog.current?.close();
    onClose();
  }

  async function selectFile(file: File) {
    const attempt = ++validation.current;
    setSelection({kind: 'validating', name: file.name});
    setError('');
    try {
      const sdl = validateSchemaSdl(await readSchemaFile(file));
      if (attempt === validation.current) setSelection({kind: 'ready', name: file.name, sdl});
    } catch (error) {
      if (attempt === validation.current) {
        setSelection({kind: 'invalid', name: file.name, error: schemaImportError(error)});
      }
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || !canSubmit) return;
    const input: SnapshotImport | null = isSdl
      ? selection?.kind === 'ready' ? {method: 'sdl', sdl: selection.sdl, fileName: selection.name} : null
      : {method: 'introspection'};
    if (!input) return;
    submitting.current = true;
    setBusy(true);
    setError('');
    try {
      await onImport(input);
      dialog.current?.close();
      onClose();
    } catch (error) {
      setError(schemaImportError(error));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  const fileError = isSdl && selection?.kind === 'invalid' ? selection.error : '';
  return (
    <dialog ref={dialog} className="create-service-dialog snapshot-import-dialog" aria-labelledby="snapshot-title"
      onCancel={event => {event.preventDefault(); close()}}
      onClick={event => {if (event.target === event.currentTarget) close()}}>
      <form onSubmit={submit}>
        <header className="snapshot-import-heading">
          <h2 id="snapshot-title">Добавить снимок схемы</h2>
          <p>Сервис: <strong>{service?.name}</strong></p>
        </header>

        <fieldset className="snapshot-import-methods" disabled={busy}>
          <legend className="snapshot-visually-hidden">Способ получения схемы</legend>
          {methods.map(({id, label}) => (
            <label key={id}>
              <input className="snapshot-visually-hidden" type="radio" name="snapshot-method" value={id}
                checked={method === id} autoFocus={id === 'sdl'}
                onChange={() => {setMethod(id); setError('')}}/>
              <span>{label}</span>
            </label>
          ))}
        </fieldset>

        {isSdl ? (
          <div className="snapshot-import-file">
            <span className="snapshot-import-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M13 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10zM13 3v7h7M8 14h8m-8 3h5"/>
              </svg>
            </span>
            <div className="snapshot-import-file-name" aria-live="polite">
              <strong title={selection?.name}>{selection?.name ?? 'Файл схемы'}</strong>
              <span>{selection?.kind === 'validating' ? 'Проверяем файл…' : selection?.kind === 'ready' ? 'Файл готов к импорту' : 'Форматы .graphql и .gql'}</span>
            </div>
            <input ref={fileInput} type="file" accept=".graphql,.gql" hidden disabled={busy} onChange={event => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = '';
              if (file) void selectFile(file);
            }}/>
            <button type="button" className="snapshot-import-choose" disabled={busy} onClick={() => fileInput.current?.click()}>
              {selection ? 'Выбрать другой' : 'Выбрать файл'}
            </button>
          </div>
        ) : (
          <div className="snapshot-import-info">
            <span className="snapshot-import-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
                <circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8h.01"/>
              </svg>
            </span>
            <p>{local ? 'Для mock-сервиса доступен импорт SDL-файла.' : 'Схема будет автоматически загружена из GraphQL API выбранного сервиса.'}</p>
          </div>
        )}

        {(fileError || error) && <p className="form-error" role="alert">{fileError || error}</p>}
        {busy && <p className="snapshot-import-progress" role="status">{isSdl ? 'Импортируем снимок…' : 'Загружаем схему…'}</p>}

        <div className="create-service-actions">
          <button type="button" disabled={busy} onClick={close}>Отмена</button>
          <button type="submit" className="primary" disabled={busy || !canSubmit}>
            {isSdl ? 'Импортировать снимок' : 'Загрузить схему'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
