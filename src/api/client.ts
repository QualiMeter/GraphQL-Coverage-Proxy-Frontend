export class ApiError extends Error {
  constructor(
    readonly kind: 'network' | 'http' | 'invalid-response',
    message: string,
    readonly status?: number,
    cause?: unknown,
    readonly code?: string,
  ) {
    super(message, {cause});
    this.name = 'ApiError';
  }
}

function httpError(status: number, code?: string): ApiError {
  const message = {
    401: 'Для доступа к API нужна действующая сессия.',
    403: 'Недостаточно прав для доступа к API.',
  }[status as 401 | 403] ?? `Сервер вернул ошибку HTTP ${status}.`;
  return new ApiError('http', message, status, undefined, code);
}

type RequestOptions = {
  signal?: AbortSignal;
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  csrfToken?: string;
  readErrorCode?: boolean;
};

export async function requestJson<T>(
  path: `/api/${string}`,
  decode: (data: unknown, response: Response) => T,
  {signal, method = 'GET', body, csrfToken, readErrorCode}: RequestOptions = {},
): Promise<T> {
  const headers = new Headers({Accept: 'application/json'});
  if (body !== undefined) headers.set('Content-Type', 'application/json');
  if (method !== 'GET' && csrfToken) headers.set('X-CSRF-Token', csrfToken);

  let response: Response;
  try {
    response = await fetch(path, {
      method, headers, signal, credentials: 'same-origin', redirect: 'error', cache: 'no-store',
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (cause) {
    if (signal?.aborted) throw cause;
    throw new ApiError('network', 'Не удалось подключиться к API.', undefined, cause);
  }

  if (!response.ok) {
    let code: string | undefined;
    if (readErrorCode) {
      const data: unknown = await response.json().catch(() => undefined);
      if (data && typeof data === 'object' && 'code' in data &&
          typeof data.code === 'string' && /^[A-Z][A-Z0-9_]{0,63}$/.test(data.code)) code = data.code;
    }
    throw httpError(response.status, code);
  }
  try {
    return decode(response.status === 204 ? undefined : await response.json(), response);
  } catch (cause) {
    if (signal?.aborted) throw cause;
    throw new ApiError('invalid-response', 'API вернул ответ в неожиданном формате.', response.status, cause);
  }
}
