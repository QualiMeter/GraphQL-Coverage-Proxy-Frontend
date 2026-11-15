import {ApiError, requestJson} from './client';

export const roles = ['viewer', 'analyst', 'operator', 'admin'] as const;
export type Role = typeof roles[number];
export type Account = {id: string; username: string; role: Role; isActive: boolean};
export type Session = {user: Account; csrfToken: string; expiresAt: string};

function decodeSession(data: unknown): Session | null {
  if (data && typeof data === 'object' && 'user' in data && 'csrfToken' in data && 'expiresAt' in data) {
    const {user, csrfToken, expiresAt} = data;
    if (user === null && csrfToken === null && expiresAt === null) return null;
    if (user && typeof user === 'object' &&
      'id' in user && typeof user.id === 'string' &&
      'username' in user && typeof user.username === 'string' &&
      'role' in user && roles.includes(user.role as Role) &&
      'isActive' in user && typeof user.isActive === 'boolean' &&
      typeof csrfToken === 'string' && csrfToken &&
      typeof expiresAt === 'string' && Number.isFinite(Date.parse(expiresAt))) {
      return {user: {id: user.id, username: user.username, role: user.role as Role, isActive: user.isActive}, csrfToken, expiresAt};
    }
  }
  throw new Error('Expected SessionOut');
}

export async function getSession(signal?: AbortSignal) {
  try {
    return await requestJson('/api/auth/session', decodeSession, {signal});
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}

export function login(username: string, password: string) {
  return requestJson('/api/auth/login', data => {
    const session = decodeSession(data);
    if (!session?.user.isActive || Date.parse(session.expiresAt) <= Date.now()) {
      throw new Error('Expected an active session');
    }
    return session;
  }, {method: 'POST', body: {username, password}});
}

export function logout(csrfToken: string) {
  return requestJson('/api/auth/logout', data => {
    if (data !== undefined) throw new Error('Expected an empty response');
  }, {method: 'POST', csrfToken});
}

export function authErrorMessage(error: unknown, action: 'login' | 'logout' | 'restore'): string {
  if (!(error instanceof ApiError)) return 'Не удалось выполнить запрос авторизации.';
  if (action === 'login') {
    switch (error.status) {
      case 401: return 'Неверный логин или пароль.';
      case 403: return 'Сервер отклонил вход с этого адреса. Откройте приложение на адресе backend по HTTPS.';
      case 422: return 'Проверьте формат логина и пароля.';
      case 429: return 'Слишком много попыток входа. Повторите позже.';
    }
  }
  if (action === 'logout' && error.status === 403) {
    return 'Сервер отклонил выход. Повторите попытку.';
  }
  return error.message;
}
