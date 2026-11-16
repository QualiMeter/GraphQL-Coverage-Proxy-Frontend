import {ApiError} from '../api/client';
import type {Session} from '../api/auth';
import type {ServiceCreate, ServiceOut, ServiceUpdate} from '../api/services';

export function canCreateService(session: Session | null): session is Session {
  return Boolean(session?.user.isActive && Date.parse(session.expiresAt) > Date.now() &&
    (session.user.role === 'operator' || session.user.role === 'admin'));
}

export type ServiceDraft = {key: string; name: string; endpointUrl: string; description: string; isPublic: boolean};
type ServiceFormError = {field: keyof Omit<ServiceDraft, 'isPublic'>; message: string};

export function validateServiceDraft(draft: ServiceDraft, existing?: ServiceOut): {input: ServiceCreate} | {error: ServiceFormError} {
  const {isPublic} = draft;
  const name = draft.name.trim();
  const key = draft.key.trim();
  const endpointUrl = draft.endpointUrl.trim();
  const description = draft.description.trim();
  if (!name || name.length > 255) return {error: {field: 'name', message: 'Введите название длиной до 255 символов.'}};
  if (!existing && (key.length > 100 || !/^[a-z][a-z0-9_-]*$/.test(key))) {
    return {error: {field: 'key', message: 'Ключ должен начинаться со строчной латинской буквы. Допустимы строчные латинские буквы, цифры, дефис и подчёркивание, до 100 символов.'}};
  }
  const url = URL.canParse(endpointUrl) ? new URL(endpointUrl) : null;
  const authority = /^https?:\/\/([^/]+)/i.exec(endpointUrl)?.[1] ?? '';
  if (!(existing && endpointUrl === (existing.endpointUrl ?? '')) && (!url || !authority || !['https:', 'http:'].includes(url.protocol) || url.hostname.endsWith('.') ||
      /[\s\\?#]/.test(endpointUrl) || [...endpointUrl].some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127) || /[@%]/.test(authority) ||
      url.username || url.password || endpointUrl.length > 2048)) {
    return {error: {field: 'endpointUrl', message: 'Укажите полный адрес GraphQL без логина, пароля, параметров запроса и фрагмента. Для production используйте HTTPS.'}};
  }
  if (description.length > 2000) return {error: {field: 'description', message: 'Описание должно содержать не более 2000 символов.'}};
  return {input: {name, key, endpointUrl, isPublic, ...(description ? {description} : {})}};
}

export function serviceCreateError(error: unknown): string {
  if (!(error instanceof ApiError)) return 'Не удалось добавить сервис.';
  switch (error.status) {
    case 401: return 'Сессия истекла. Войдите снова, чтобы добавить сервис.';
    case 403: return 'Сервер отклонил создание сервиса. Проверьте права и откройте приложение на разрешённом адресе.';
    case 409: return 'Сервис с таким ключом уже существует. Выберите другой ключ.';
    case 422: return 'Сервер отклонил данные. Проверьте поля формы и убедитесь, что адрес GraphQL разрешён политикой backend.';
  }
  if (error.kind === 'network' || error.kind === 'invalid-response' || error.status && error.status >= 500) {
    return 'Не удалось подтвердить создание сервиса. Проверьте список сервисов перед повторной отправкой.';
  }
  return error.message;
}

export function servicePatch(existing: ServiceOut, input: ServiceCreate): ServiceUpdate {
  const patch: ServiceUpdate = {};
  if (input.name !== existing.name) patch.name = input.name;
  if (input.isPublic !== existing.isPublic) patch.isPublic = input.isPublic;
  if (input.endpointUrl !== (existing.endpointUrl ?? '')) patch.endpointUrl = input.endpointUrl;
  if ((input.description ?? null) !== (existing.description ?? null)) patch.description = input.description ?? null;
  return patch;
}

export function serviceUpdateError(error: unknown) {
  if (!(error instanceof ApiError)) return 'Не удалось сохранить изменения.';
  if (error.status === 409) return 'Endpoint нельзя изменить при активном прогоне сервиса. Завершите прогон и повторите попытку.';
  if (error.status === 401) return 'Сессия истекла. Войдите снова для редактирования.';
  if (error.status === 403 || error.status === 404) return 'Сервис недоступен для редактирования. Проверьте права доступа.';
  if (error.status === 422) return 'Сервер отклонил данные. Проверьте поля и политику допустимых адресов GraphQL.';
  return error.message;
}

export function endpointStatus(url: string | null, role?: string) {
  if (url) {
    try {
      const parsed = new URL(url);
      return `Endpoint настроен · ${parsed.host}${parsed.pathname}`;
    } catch {return 'Endpoint настроен'}
  }
  if (role === 'admin') return 'Endpoint не настроен';
  if (role === 'operator') return 'Endpoint не настроен или скрыт правами доступа';
  return 'Endpoint доступен только пользователям с правами настройки';
}
