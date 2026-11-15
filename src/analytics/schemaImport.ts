import {Kind, parse} from 'graphql';
import {ApiError} from '../api/client';

export type SnapshotImport =
  | {method: 'sdl'; sdl: string; fileName?: string}
  | {method: 'introspection'};

const maxSdlLength = 1_000_000;

export async function readSchemaFile(file: File): Promise<string> {
  if (!/\.(graphql|gql)$/i.test(file.name)) throw new Error('Выберите файл .graphql или .gql.');
  if (file.size > 4 * maxSdlLength + 3) throw new Error('Файл SDL слишком большой.');
  try {
    return new TextDecoder('utf-8', {fatal: true}).decode(await file.arrayBuffer());
  } catch {
    throw new Error('Не удалось прочитать файл SDL в кодировке UTF-8.');
  }
}

export function validateSchemaSdl(text: string): string {
  const sdl = text.trim();
  if (!sdl) throw new Error('Файл SDL пуст. Выберите другой файл.');
  if (sdl.length > maxSdlLength && [...sdl].length > maxSdlLength) {
    throw new Error('SDL должен содержать не более 1 000 000 символов.');
  }

  let document;
  try {
    document = parse(sdl, {noLocation: true});
  } catch {
    throw new Error('Не удалось разобрать SDL. Проверьте синтаксис схемы.');
  }
  if (document.definitions.some(definition =>
    definition.kind === Kind.OPERATION_DEFINITION || definition.kind === Kind.FRAGMENT_DEFINITION)) {
    throw new Error('Ожидается схема SDL. Удалите из текста запросы, мутации и фрагменты.');
  }
  return sdl;
}

const introspectionErrors: Partial<Record<string, string>> = {
  SERVICE_ENDPOINT_NOT_CONFIGURED: 'Для сервиса не настроен GraphQL endpoint. Можно импортировать SDL.',
  SERVICE_ENDPOINT_CHANGED: 'Адрес сервиса изменился во время загрузки. Повторите попытку.',
  UPSTREAM_NOT_ALLOWED: 'Адрес сервиса запрещён правилами backend. Можно импортировать SDL.',
  INTROSPECTION_DISABLED: 'Introspection отключена на GraphQL-сервере. Импортируйте схему через SDL.',
  SCHEMA_IMPORT_CONFLICT: 'Возник конфликт сохранения снимка. Обновите список снимков и повторите попытку.',
  DNS_UNAVAILABLE: 'Backend не смог определить адрес GraphQL-сервера. Можно импортировать SDL.',
  UPSTREAM_UNAVAILABLE: 'Backend не смог подключиться к GraphQL-серверу. Можно импортировать SDL.',
  UPSTREAM_HTTP_ERROR: 'GraphQL-сервер отклонил запрос introspection. Можно импортировать SDL.',
  UPSTREAM_REDIRECT: 'GraphQL endpoint перенаправляет запрос. Проверьте адрес сервиса или импортируйте SDL.',
  INVALID_JSON: 'GraphQL-сервер вернул ответ с неверным форматом. Можно импортировать SDL.',
  UPSTREAM_GRAPHQL_ERRORS: 'GraphQL-сервер вернул ошибку introspection. Можно импортировать SDL.',
  INVALID_INTROSPECTION: 'Ответ introspection не содержит корректной схемы. Можно импортировать SDL.',
  INTROSPECTION_LIMIT_EXCEEDED: 'Ответ introspection превысил допустимый размер или сложность. Импортируйте SDL.',
  UPSTREAM_CAPACITY_EXHAUSTED: 'Backend временно занят. Повторите попытку позже.',
  SCHEMA_STORAGE_UNAVAILABLE: 'Backend не смог сохранить снимок. Повторите попытку позже.',
  UPSTREAM_TIMEOUT: 'GraphQL-сервер не ответил вовремя. Можно импортировать SDL.',
};

export function schemaImportError(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return error instanceof Error ? error.message : 'Не удалось импортировать схему.';
  }
  switch (error.status) {
    case 401: return 'Сессия истекла. Войдите снова, чтобы импортировать схему.';
    case 403: return 'Backend отклонил импорт. Проверьте права на сервис и настройки входа.';
    case 404: return 'Сервис отсутствует или недоступен для импорта.';
    case 413: return 'Запрос слишком большой. Уменьшите размер SDL.';
    case 422: return 'Backend отклонил данные импорта. Проверьте SDL или настройки выбранного сервиса.';
  }
  if (error.code && Object.hasOwn(introspectionErrors, error.code)) return introspectionErrors[error.code]!;
  return 'Не удалось подтвердить импорт. Проверьте список снимков перед повторной попыткой.';
}
