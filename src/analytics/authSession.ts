import {getSession, login, logout, type Session} from '../api/auth';
import {ApiError} from '../api/client';

type State = {
  session: Session | null;
  checked: boolean;
  revision: number;
  pending: 'login' | 'logout' | null;
  error: unknown;
};

export function createAuthSession() {
  let state: State = {session: null, checked: false, revision: 0, pending: null, error: null};
  let read: AbortController | undefined;
  const listeners = new Set<() => void>();
  function update(patch: Partial<State>) {
    state = {...state, ...patch};
    listeners.forEach(listener => listener());
  }

  function applySession(session: Session | null, refreshCatalog = false) {
    const active = session?.user.isActive && Date.parse(session.expiresAt) > Date.now() ? session : null;
    const previous = state.session;
    const changed = previous?.user.id !== active?.user.id || previous?.user.role !== active?.user.role ||
      previous?.csrfToken !== active?.csrfToken;
    update({
      session: active, checked: true, error: null,
      revision: state.revision + Number(changed || refreshCatalog),
    });
  }

  async function restore() {
    if (state.pending || read) return;
    const controller = new AbortController();
    read = controller;
    try {
      const session = await getSession(controller.signal);
      if (!controller.signal.aborted) applySession(session);
    } catch (error) {
      if (!controller.signal.aborted) update({checked: true, error});
    } finally {
      if (read === controller) read = undefined;
    }
  }

  function cancelRestore() {
    read?.abort();
    read = undefined;
  }

  function start(pending: State['pending']) {
    cancelRestore();
    update({pending, error: null});
  }

  return {
    snapshot: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {listeners.delete(listener)};
    },
    restore,
    cancelRestore,
    expire() {
      if (state.session && Date.parse(state.session.expiresAt) <= Date.now()) applySession(null);
    },
    async signIn(username: string, password: string) {
      if (state.pending) return;
      start('login');
      try {
        applySession(await login(username, password), true);
      } finally {
        update({pending: null});
      }
    },
    async signOut() {
      const session = state.session;
      if (!session || state.pending) return;
      start('logout');
      try {
        await logout(session.csrfToken);
        applySession(null, true);
      } catch (error) {
        if (!(error instanceof ApiError)) throw error;
        if (error.status === 401) {
          applySession(null, true);
        } else if (error.status === 403) {
          const current = await getSession().catch(() => undefined);
          if (current !== undefined) applySession(current);
          if (state.session) throw error;
        } else {
          throw error;
        }
      } finally {
        update({pending: null});
      }
    },
  };
}
