import {useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent} from 'react';
import {authErrorMessage, type Role} from '../api/auth';
import type {useAuth} from './useAuth';
import './auth.css';
import {AccountIcon} from './AccountIcon';

export const roleNames: Record<Role, string> = {
  viewer: 'Наблюдатель',
  analyst: 'Аналитик',
  operator: 'Оператор',
  admin: 'Администратор',
};

type Props = {auth: ReturnType<typeof useAuth>; loginHint?: string; onPromptClose: () => void; onAdmin:()=>void};

export function AccountControl({auth, loginHint, onPromptClose, onAdmin}: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const password = useRef<HTMLInputElement>(null);
  const account = useRef<HTMLDivElement>(null);
  const accountTrigger = useRef<HTMLButtonElement>(null);
  const profilePanel = useRef<HTMLElement>(null);
  const panelId=useId();
  const loginTrigger = useRef<HTMLButtonElement>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [logoutError, setLogoutError] = useState('');
  const [profileOpen,setProfileOpen]=useState(false);
  const user = auth.session?.user;

  useEffect(() => {
    if (user) dialog.current?.close();
  }, [user]);
  useEffect(() => {
    if(!user||!profileOpen)return;
    profilePanel.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
    function dismiss(event:PointerEvent) {
      if(!account.current?.contains(event.target as Node))setProfileOpen(false);
    }
    document.addEventListener('pointerdown',dismiss);
    return ()=>document.removeEventListener('pointerdown',dismiss);
  },[user,profileOpen]);

  function closeProfile() {
    setProfileOpen(false);
    accountTrigger.current?.focus();
  }
  function profileKeys(event:KeyboardEvent) {
    if(event.key==='Escape'&&profileOpen){event.preventDefault();closeProfile();return}
    if(!profileOpen||!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return;
    const actions=[...(profilePanel.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')??[])];
    if(!actions.length)return;
    event.preventDefault();
    const index=actions.indexOf(document.activeElement as HTMLButtonElement);
    const next=event.key==='Home'?0:event.key==='End'?actions.length-1:
      event.key==='ArrowDown'?(index+1)%actions.length:index<=0?actions.length-1:index-1;
    actions[next].focus();
  }

  useEffect(() => {
    if (!loginHint || user || !dialog.current || dialog.current.open) return;
    dialog.current.showModal();
  }, [loginHint, user]);

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
      setProfileOpen(false);
      setLogoutError('');
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
      setProfileOpen(false);
      requestAnimationFrame(() => loginTrigger.current?.focus());
    } catch (error) {
      setLogoutError(authErrorMessage(error, 'logout'));
    }
  }

  const signingIn = auth.pending === 'login';
  return (
    <div className="auth-control">
      {user ? (
        <div className="auth-account profile-control" ref={account} onKeyDown={profileKeys} onBlur={event=>{
          if(event.relatedTarget&&!event.currentTarget.contains(event.relatedTarget))setProfileOpen(false);
        }}>
          <button type="button" ref={accountTrigger} className="auth-trigger account-avatar" title={user.username}
            aria-label={`Аккаунт · ${user.username}`} aria-expanded={profileOpen} aria-controls={profileOpen?panelId:undefined}
            onClick={()=>profileOpen?closeProfile():setProfileOpen(true)} onKeyDown={event=>{
              if(!profileOpen&&event.key==='ArrowDown'){event.preventDefault();setProfileOpen(true)}
            }}>
            <span aria-hidden="true">{user.username.slice(0,2).toUpperCase()}</span>
          </button>
          {profileOpen&&<section id={panelId} ref={profilePanel} className="profile-panel" aria-label="Учётная запись">
            <div className="profile-identity">
              <span className="profile-initials" aria-hidden="true">{user.username.slice(0,2).toUpperCase()}</span>
              <div><strong>{user.username}</strong><small>{roleNames[user.role]}</small></div>
            </div>
            <ProfileActions role={user.role}
              onAdmin={()=>{closeProfile();onAdmin()}} onLogout={()=>void submitLogout()}
              loggingOut={auth.pending==='logout'} error={logoutError}/>
          </section>}
        </div>
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
          if (loginHint) onPromptClose();
        }}
        onClick={event => {
          if (event.target === event.currentTarget && !signingIn) dialog.current?.close();
        }}
      >
        <form onSubmit={submitLogin} aria-busy={signingIn}>
          <h2 id="auth-title">Вход в систему</h2>
          {loginHint && <p>{loginHint}</p>}
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


export function ProfileActions({role,onAdmin,onLogout,loggingOut,error}:{
  role:Role;onAdmin:()=>void;onLogout:()=>void;loggingOut:boolean;error:string;
}) {
  return <>
    {role==='admin'&&<div className="profile-actions">
      <button type="button" onClick={onAdmin}><AccountIcon name="users"/>Управление пользователями</button>
    </div>}
    <div className="profile-actions">
      <button type="button" onClick={onLogout} disabled={loggingOut}><AccountIcon name="logout"/>{loggingOut?'Выходим…':'Выйти'}</button>
      {error&&<p className="profile-error" role="alert">{error}</p>}
    </div>
  </>;
}
