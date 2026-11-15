export class ApiError extends Error {
  constructor(
    readonly kind: 'network' | 'http' | 'invalid-response',
    message: string,
    readonly status?: number,
    cause?: unknown,
  ) {
    super(message, {cause});
    this.name = 'ApiError';
  }
}

function httpError(status: number): ApiError {
  const message = {
    401: 'Для доступа к API нужна действующая сессия.',
    403: 'Недостаточно прав для доступа к API.',
  }[status as 401 | 403] ?? `Сервер вернул ошибку HTTP ${status}.`;
  return new ApiError('http', message, status);
}

type RequestOptions = {
  signal?: AbortSignal;
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  csrfToken?: string;
};

export async function requestJson<T>(
  path: `/api/${string}`,
  decode: (data: unknown) => T,
  {signal, method = 'GET', body, csrfToken}: RequestOptions = {},
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

  if (!response.ok) throw httpError(response.status);
  try {
    return decode(response.status === 204 ? undefined : await response.json());
  } catch (cause) {
    if (signal?.aborted) throw cause;
    throw new ApiError('invalid-response', 'API вернул ответ в неожиданном формате.', response.status, cause);
  }
}
