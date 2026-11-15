import {useEffect, useRef, useState, type FormEvent} from 'react';
import {authErrorMessage, type Role} from '../api/auth';
import type {useAuth} from './useAuth';
import './auth.css';

const roleNames: Record<Role, string> = {
  viewer: 'Наблюдатель',
  analyst: 'Аналитик',
  operator: 'Оператор',
  admin: 'Администратор',
};

export function AccountControl({auth}: {auth: ReturnType<typeof useAuth>}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const password = useRef<HTMLInputElement>(null);
  const account = useRef<HTMLDetailsElement>(null);
  const accountTrigger = useRef<HTMLElement>(null);
  const loginTrigger = useRef<HTMLButtonElement>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [logoutError, setLogoutError] = useState('');
  const user = auth.session?.user;

  useEffect(() => {
    if (!user) return;
    dialog.current?.close();
    function dismiss(event: PointerEvent) {
      const menu = account.current;
      if (menu && !menu.contains(event.target as Node)) menu.open = false;
    }
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [user]);

  function openLogin() {
    setLoginError(auth.error ? authErrorMessage(auth.error, 'restore') : '');
    dialog.current?.showModal();
  }

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (auth.pending || !password.current) return;
    const username = new FormData(event.currentTarget).get('username') as string;
    const input = password.current;
    setLoginError('');
    try {
      await auth.signIn(username, input.value);
      dialog.current?.close();
      requestAnimationFrame(() => accountTrigger.current?.focus());
    } catch (error) {
      setLoginError(authErrorMessage(error, 'login'));
      requestAnimationFrame(() => password.current?.focus());
    } finally {
      input.value = '';
      setShowPassword(false);
    }
  }

  async function submitLogout() {
    if (auth.pending) return;
    setLogoutError('');
    try {
      await auth.signOut();
      requestAnimationFrame(() => loginTrigger.current?.focus());
    } catch (error) {
      setLogoutError(authErrorMessage(error, 'logout'));
    }
  }

  const signingIn = auth.pending === 'login';
  return (
    <div className="auth-control">
      {user ? (
        <details
          className="auth-account"
          key={user.id}
          ref={account}
          onBlur={event => {
            if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false;
          }}
          onKeyDown={event => {
            if (event.key === 'Escape' && event.currentTarget.open) {
              event.preventDefault();
              event.currentTarget.open = false;
              accountTrigger.current?.focus();
            }
          }}
        >
          <summary ref={accountTrigger} className="auth-trigger" title={user.username}>
            <span>{user.username}</span><span className="auth-chevron" aria-hidden="true">⌄</span>
          </summary>
          <section className="auth-account-panel" aria-label="Учётная запись">
            <strong>{user.username}</strong>
            <p>{roleNames[user.role]}</p>
            {logoutError && <p className="auth-error" role="alert">{logoutError}</p>}
            <button type="button" onClick={() => void submitLogout()} aria-disabled={auth.pending === 'logout'}>
              {auth.pending === 'logout' ? 'Выходим…' : 'Выйти'}
            </button>
          </section>
        </details>
      ) : (
        <button ref={loginTrigger} className="auth-trigger" type="button" onClick={openLogin}>
          Войти
        </button>
      )}
      <dialog
        ref={dialog}
        className="create-service-dialog auth-dialog"
        aria-labelledby="auth-title"
        onCancel={event => {if (signingIn) event.preventDefault()}}
        onClose={() => {
          if (password.current) password.current.value = '';
          setShowPassword(false);
          setLoginError('');
        }}
        onClick={event => {
          if (event.target === event.currentTarget && !signingIn) dialog.current?.close();
        }}
      >
        <form onSubmit={submitLogin} aria-busy={signingIn}>
          <h2 id="auth-title">Вход в систему</h2>
          <fieldset disabled={signingIn}>
            <label htmlFor="auth-username">Логин</label>
            <input id="auth-username" name="username" autoComplete="username" autoFocus required
              maxLength={100} pattern="[a-z][a-z0-9_.\x2d]*" autoCapitalize="none" spellCheck={false}/>
            <label htmlFor="auth-password">Пароль</label>
            <div className="auth-password">
              <input id="auth-password" name="password" ref={password} autoComplete="current-password"
                type={showPassword ? 'text' : 'password'} maxLength={128} required/>
              <button
                type="button"
                aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                aria-controls="auth-password"
                onClick={() => setShowPassword(value => !value)}
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20"
                  fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  {showPassword ? (
                    <>
                      <path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.2A10 10 0 0 1 12 5c6 0 10 7 10 7a16 16 0 0 1-2.6 3.3M6.1 6.8A17 17 0 0 0 2 12s4 7 10 7a9.6 9.6 0 0 0 4-1"/>
                    </>
                  ) : (
                    <>
                      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </>
                  )}
                </svg>
              </button>
            </div>
          </fieldset>
          {loginError && <p role="alert" className="form-error">{loginError}</p>}
          <div className="create-service-actions">
            <button type="button" onClick={() => dialog.current?.close()} disabled={signingIn}>Отмена</button>
            <button type="submit" className="primary" disabled={signingIn}>{signingIn ? 'Входим…' : 'Войти'}</button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
