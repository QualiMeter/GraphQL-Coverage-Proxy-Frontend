import {useCallback, useEffect, useRef, useState, type FormEvent} from 'react';
import {ApiError} from '../api/client';
import {hasActiveRun} from '../api/runs';
import type {ServiceCreate, ServiceOut, ServiceUpdate} from '../api/services';
import {serviceCreateError, servicePatch, serviceUpdateError, validateServiceDraft} from './serviceCreation';
import {useBackendRead} from './useBackendRead';
import './createService.css';
import './settingsDialog.css';

type Props = {
  onClose: () => void;
  onCreate: (input: ServiceCreate) => Promise<void>;
  edit?: {service: ServiceOut; role?: string; hasSelectedActiveRun: boolean; onUpdate: (input: ServiceUpdate) => Promise<void>};
};

export function CreateServiceDialog({onClose, onCreate, edit}: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const submitting = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [invalid, setInvalid] = useState<string>();
  const endpoint = edit?.service.endpointUrl ?? '';
  const [endpointDraft, setEndpointDraft] = useState(endpoint);
  const [endpointConflict, setEndpointConflict] = useState(false);
  const serviceId = edit?.service.id;
  const loadActive = useCallback((signal: AbortSignal) => hasActiveRun(serviceId!, signal), [serviceId]);
  const active = useBackendRead(serviceId ?? null, loadActive);
  const endpointLocked = Boolean(endpointConflict || (active.data ?? edit?.hasSelectedActiveRun));
  const endpointReadOnly = endpointLocked || active.loading;
  const endpointVisibility = edit?.role === 'admin' ? 'Адрес не настроен' : 'Адрес не настроен или скрыт правами доступа';

  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
  }, []);

  function close() {
    if (submitting.current) return;
    dialog.current?.close();
    onClose();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    const result = validateServiceDraft({
      name: String(values.get('name') ?? ''),
      key: edit?.service.key ?? String(values.get('key') ?? ''),
      endpointUrl: endpointReadOnly ? endpoint : String(values.get('endpointUrl') ?? ''),
      description: String(values.get('description') ?? ''),
      isPublic: values.has('isPublic'),
    }, edit?.service);
    if ('error' in result) {
      setError(result.error.message);
      setInvalid(result.error.field);
      (form.elements.namedItem(result.error.field) as HTMLElement | null)?.focus();
      return;
    }
    submitting.current = true;
    setBusy(true);
    setError('');
    setInvalid(undefined);
    try {
      if (edit) {
        const patch = servicePatch(edit.service, result.input);
        if (Object.keys(patch).length) await edit.onUpdate(patch);
      } else await onCreate(result.input);
      dialog.current?.close();
      onClose();
    } catch (error) {
      if (edit && result.input.endpointUrl !== endpoint && error instanceof ApiError && error.status === 409) {
        setEndpointConflict(true);
        setEndpointDraft(endpoint);
      }
      setError(edit ? serviceUpdateError(error) : serviceCreateError(error));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
    <dialog ref={dialog}
      className={`create-service-dialog service-create-dialog${edit ? ' settings-dialog service-settings-dialog' : ''}`}
      aria-labelledby="service-create-title"
      onCancel={event => {event.preventDefault(); close()}}
      onClick={event => {if (event.target === event.currentTarget) close()}}>
      <form onSubmit={submit} noValidate aria-busy={busy}>
        <h2 id="service-create-title">{edit ? 'Настройки сервиса' : 'Добавить сервис'}</h2>
        <fieldset disabled={busy}>
          <label htmlFor="service-name">{edit ? 'Название сервиса' : 'Название'}</label>
          <input id="service-name" name="name" defaultValue={edit?.service.name} required maxLength={255} autoFocus aria-invalid={invalid === 'name'}/>
          {edit ? <dl className="settings-context">
            <dt>Уникальный ключ</dt>
            <dd><code>{edit.service.key}</code></dd>
            <dd className="settings-hint">Постоянный идентификатор сервиса.</dd>
          </dl> : <>
            <label htmlFor="service-key">Уникальный ключ</label>
            <input id="service-key" name="key" required maxLength={100} autoCapitalize="none" autoComplete="off" spellCheck={false}
              placeholder="orders" aria-invalid={invalid === 'key'}/>
          </>}
          <label htmlFor="service-endpoint">GraphQL endpoint URL</label>
          {edit ? <>
            <input id="service-endpoint" name="endpointUrl" type="url" value={endpointReadOnly ? endpoint : endpointDraft}
              onChange={event => setEndpointDraft(event.target.value)} readOnly={endpointReadOnly}
              required={Boolean(endpoint)} maxLength={2048} spellCheck={false} autoComplete="off"
              aria-describedby="service-endpoint-help" aria-invalid={invalid === 'endpointUrl'}/>
            <div id="service-endpoint-help" className="settings-hint settings-endpoint-help" aria-live="polite">
              {!endpoint && <span>{endpointVisibility}.</span>}
              {endpointLocked ? <span className="endpoint-lock-note">Для изменения адреса необходимо завершить активный прогон.</span>
                : active.loading ? <span>Проверяем активные прогоны…</span>
                : active.error ? <span>Сервер проверит возможность изменения адреса при сохранении.</span>
                : !endpoint && <span>Укажите полный URL GraphQL API.</span>}
            </div>
          </> : <input id="service-endpoint" name="endpointUrl" type="url" required maxLength={2048} spellCheck={false}
            placeholder="https://example.com/graphql" aria-invalid={invalid === 'endpointUrl'}/>}
          <label htmlFor="service-description">Описание <span>необязательно</span></label>
          <textarea id="service-description" name="description" defaultValue={edit?.service.description??''} rows={2} maxLength={2000} aria-invalid={invalid === 'description'}/>
          {edit ? <label className="settings-public">
            <input name="isPublic" type="checkbox" defaultChecked={edit.service.isPublic} aria-describedby="service-public-help"/>
            <span className="settings-public-copy"><strong>Публичный сервис</strong>
              <small id="service-public-help">Сервис виден в каталоге без входа. Посетителям доступны данные, разрешённые для публичного просмотра.</small>
            </span>
          </label> : <>
            <label className="service-create-public"><input name="isPublic" type="checkbox"/> Публичный сервис</label>
            <small>Публичный сервис виден в каталоге без входа.</small>
          </>}
        </fieldset>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="create-service-actions">
          <button type="button" disabled={busy} onClick={close}>Отмена</button>
          <button className="primary" type="submit" disabled={busy}>{edit ? busy ? 'Сохраняем…' : 'Сохранить изменения' : busy ? 'Добавляем…' : 'Добавить сервис'}</button>
        </div>
      </form>
    </dialog>
  );
}
