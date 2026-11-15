import {useEffect, useRef, useState, type FormEvent} from 'react';
import {serviceCreateError, validateServiceDraft} from './serviceCreation';
import type {ServiceCreate} from '../api/services';
import './createService.css';

type Props = {
  onClose: () => void;
  onCreate: (input: ServiceCreate) => Promise<void>;
};

export function CreateServiceDialog({onClose, onCreate}: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const submitting = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [invalid, setInvalid] = useState<string>();
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
      key: String(values.get('key') ?? ''),
      endpointUrl: String(values.get('endpointUrl') ?? ''),
      description: String(values.get('description') ?? ''),
      isPublic: values.has('isPublic'),
    });
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
      await onCreate(result.input);
      dialog.current?.close();
      onClose();
    } catch (error) {
      setError(serviceCreateError(error));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
    <dialog ref={dialog} className="create-service-dialog service-create-dialog" aria-labelledby="service-create-title"
      onCancel={event => {event.preventDefault(); close()}}
      onClick={event => {if (event.target === event.currentTarget) close()}}>
      <form onSubmit={submit} noValidate aria-busy={busy}>
        <h2 id="service-create-title">Добавить сервис</h2>
        <fieldset disabled={busy}>
          <label htmlFor="service-name">Название</label>
          <input id="service-name" name="name" required maxLength={255} autoFocus aria-invalid={invalid === 'name'}/>
          <label htmlFor="service-key">Уникальный ключ</label>
          <input id="service-key" name="key" required maxLength={100} autoCapitalize="none" autoComplete="off" spellCheck={false}
            placeholder="orders" aria-invalid={invalid === 'key'}/>
          <label htmlFor="service-endpoint">GraphQL endpoint URL</label>
          <input id="service-endpoint" name="endpointUrl" type="url" required maxLength={2048} spellCheck={false}
            placeholder="https://example.com/graphql" aria-invalid={invalid === 'endpointUrl'}/>
          <label htmlFor="service-description">Описание <span>необязательно</span></label>
          <textarea id="service-description" name="description" rows={2} maxLength={2000} aria-invalid={invalid === 'description'}/>
          <label className="service-create-public"><input name="isPublic" type="checkbox"/> Публичный сервис</label>
          <small>Публичный сервис виден в каталоге без входа.</small>
        </fieldset>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="create-service-actions">
          <button type="button" disabled={busy} onClick={close}>Отмена</button>
          <button className="primary" type="submit" disabled={busy}>{busy ? 'Добавляем…' : 'Добавить сервис'}</button>
        </div>
      </form>
    </dialog>
  );
}
