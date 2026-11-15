import {afterEach, describe, expect, it, vi} from 'vitest';
import {authErrorMessage} from '../api/auth';
import {createAuthSession} from './authSession';

const account = {id: '85148c00-ced9-40f4-99f3-4a245ef9ca10', username: 'test-viewer', role: 'viewer', isActive: true};
const active = () => ({user: account, csrfToken: 'test-csrf', expiresAt: new Date(Date.now() + 60_000).toISOString()});
const anonymous = () => Response.json({user: null, csrfToken: null, expiresAt: null});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('auth session', () => {
  it('restores a cookie session and invalidates the catalog only when access changes', async () => {
    const session = active();
    const fetch = vi.fn().mockResolvedValueOnce(Response.json(session))
      .mockResolvedValueOnce(Response.json(session)).mockResolvedValueOnce(anonymous());
    vi.stubGlobal('fetch', fetch);
    const auth = createAuthSession();

    await auth.restore();
    expect(auth.snapshot()).toMatchObject({checked: true, session, revision: 1});
    expect(fetch).toHaveBeenCalledWith('/api/auth/session', expect.objectContaining({credentials: 'same-origin'}));
    await auth.restore();
    expect(auth.snapshot().revision).toBe(1);
    await auth.restore();
    expect(auth.snapshot()).toMatchObject({session: null, revision: 2});
  });

  it.each(['operator', 'admin'] as const)('supports %s login and restores its session after a page reload', async role => {
    const session = {...active(), user: {...account, role}};
    const fetch = vi.fn().mockResolvedValueOnce(anonymous()).mockResolvedValueOnce(Response.json(session));
    vi.stubGlobal('fetch', fetch);
    const auth = createAuthSession();
    const states: ReturnType<typeof auth.snapshot>[] = [];
    auth.subscribe(() => states.push(auth.snapshot()));

    await auth.restore();
    await auth.signIn('test-viewer', 'test-password');

    expect(fetch).toHaveBeenLastCalledWith('/api/auth/login', expect.objectContaining({
      method: 'POST', credentials: 'same-origin',
      body: JSON.stringify({username: 'test-viewer', password: 'test-password'}),
    }));
    expect(states.some(state => state.pending === 'login')).toBe(true);
    expect(auth.snapshot()).toMatchObject({session, revision: 1, pending: null});

    fetch.mockResolvedValueOnce(Response.json(session));
    const afterReload = createAuthSession();
    await afterReload.restore();
    expect(afterReload.snapshot()).toMatchObject({session, checked: true});
  });

  it.each([
    [401, 'Неверный логин или пароль.'],
    [403, 'Сервер отклонил вход с этого адреса.'],
    [429, 'Слишком много попыток входа.'],
  ])('handles login HTTP %s without changing the catalog scope', async (status, message) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, {status})));
    const auth = createAuthSession();
    const error = await auth.signIn('test-viewer', 'test-password').catch((error: unknown) => error);

    expect(error).toMatchObject({status});
    expect(authErrorMessage(error, 'login')).toContain(message);
    expect(auth.snapshot()).toMatchObject({session: null, revision: 0, pending: null});
  });

  it.each([204, 401])('clears the session after logout HTTP %s and refreshes the catalog', async status => {
    const fetch = vi.fn().mockResolvedValueOnce(Response.json(active()))
      .mockResolvedValueOnce(new Response(null, {status}));
    vi.stubGlobal('fetch', fetch);
    const auth = createAuthSession();

    await auth.restore();
    await auth.signOut();

    expect(fetch).toHaveBeenLastCalledWith('/api/auth/logout', expect.objectContaining({method: 'POST'}));
    expect(fetch.mock.calls[1][1].headers.get('X-CSRF-Token')).toBe('test-csrf');
    expect(auth.snapshot()).toMatchObject({session: null, revision: 2, pending: null});
  });

  it('rechecks a rejected logout and retains the current session when it is still active', async () => {
    const session = active();
    const fetch = vi.fn().mockResolvedValueOnce(Response.json(session))
      .mockResolvedValueOnce(new Response(null, {status: 403})).mockResolvedValueOnce(Response.json(session));
    vi.stubGlobal('fetch', fetch);
    const auth = createAuthSession();

    await auth.restore();
    await expect(auth.signOut()).rejects.toMatchObject({status: 403});
    expect(auth.snapshot()).toMatchObject({session, revision: 1, pending: null});
  });

  it('reports restore network failure and clears a previously restored session at expiry', async () => {
    vi.useFakeTimers();
    const fetch = vi.fn().mockResolvedValueOnce(Response.json(active()))
      .mockRejectedValueOnce(new TypeError('offline'));
    vi.stubGlobal('fetch', fetch);
    const auth = createAuthSession();

    await auth.restore();
    await auth.restore();
    expect(auth.snapshot().error).toMatchObject({kind: 'network'});
    expect(auth.snapshot().session?.user.username).toBe('test-viewer');
    vi.setSystemTime(Date.now() + 60_000);
    auth.expire();
    expect(auth.snapshot()).toMatchObject({session: null, revision: 2});
  });

  it('ignores a stale restore response that completes after login starts', async () => {
    let completeRestore!: (response: Response) => void;
    const oldRestore = new Promise<Response>(resolve => {completeRestore = resolve});
    const session = active();
    vi.stubGlobal('fetch', vi.fn().mockReturnValueOnce(oldRestore).mockResolvedValueOnce(Response.json(session)));
    const auth = createAuthSession();

    const restoring = auth.restore();
    await auth.signIn('test-viewer', 'test-password');
    completeRestore(anonymous());
    await restoring;

    expect(auth.snapshot()).toMatchObject({session, revision: 1});
  });
});
