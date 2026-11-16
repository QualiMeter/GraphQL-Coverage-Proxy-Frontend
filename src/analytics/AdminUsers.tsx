import {useEffect,useRef,useState,type FormEvent,type ReactNode} from 'react';
import {canManageUsers,createUser,listUsers,setServiceAccess,updateUser} from '../api/admin';
import {roles,type Account,type Role} from '../api/auth';
import {ApiError} from '../api/client';
import {AccountIcon} from './AccountIcon';
import {roleNames} from './AccountControl';
import {analyticsError} from './runAnalyticsModel';
import {useBackendRead} from './useBackendRead';
import type {useAuth} from './useAuth';

type Service = {id:string;name:string};
type Props = {auth:ReturnType<typeof useAuth>;services:Service[];onClose:()=>void};
type Mutation = (token:string)=>Promise<void>;

function RoleOptions(){return roles.map(role=><option key={role} value={role}>{roleNames[role]}</option>)}

function AdminDialog({title,id,drawer,busy,onClose,children}:{
  title:string;id:string;drawer?:boolean;busy:boolean;onClose:()=>void;children:ReactNode;
}) {
  const dialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{
    const element=dialog.current;
    if(!element?.open)element?.showModal();
    return ()=>element?.close();
  },[]);
  function close(){
    if(busy)return;
    dialog.current?.close();
    onClose();
  }
  return <dialog ref={dialog} className={`create-service-dialog admin-dialog ${drawer?'admin-drawer':'admin-create'}`}
    aria-labelledby={id} onCancel={event=>{event.preventDefault();close()}}
    onClick={event=>{if(event.target===event.currentTarget)close()}}>
    <div className="admin-dialog-content">
      <header className="admin-dialog-header"><h2 id={id}>{title}</h2>
        {drawer&&<button type="button" className="run-control" onClick={close} aria-label="Закрыть карточку" disabled={busy} autoFocus>×</button>}
      </header>
      {children}
    </div>
  </dialog>;
}

function Status({active}:{active:boolean}) {
  return <span className="run-badge" data-status={active?'active':'completed'}>{active?'Активен':'Отключён'}</span>;
}

function UserCard({user,services,grants,busy,error,message,change,onUpdate,onGrant,onClose}:{
  user:Account;services:Service[];grants:Record<string,boolean>;busy:boolean;error:string;message:string;
  change:(action:Mutation)=>Promise<void>;onUpdate:(user:Account)=>void;onGrant:(serviceId:string,granted:boolean)=>void;onClose:()=>void;
}) {
  const [role,setRole]=useState(user.role);
  const [active,setActive]=useState(user.isActive);
  const [query,setQuery]=useState('');
  const feedback=useRef<HTMLParagraphElement>(null);
  useEffect(()=>{if(message||error)feedback.current?.focus()},[message,error]);
  const visible=services.filter(service=>service.name.toLocaleLowerCase('ru').includes(query.trim().toLocaleLowerCase('ru')));
  const groups=[
    {title:'Подтверждённые назначения',services:visible.filter(service=>grants[service.id]===true)},
    {title:'Остальные сервисы',services:visible.filter(service=>grants[service.id]!==true)},
  ];
  function save(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    void change(async token=>onUpdate(await updateUser(user.id,{role,isActive:active},token)));
  }
  return <AdminDialog id="user-card-title" title={user.username} drawer busy={busy} onClose={onClose}>
    <div className="admin-identity-meta"><span>{roleNames[user.role]}</span><Status active={user.isActive}/></div>
    <form className="admin-form admin-user-edit" onSubmit={save} aria-busy={busy}>
      <fieldset disabled={busy}>
        <label>Роль<select value={role} onChange={event=>setRole(event.target.value as Role)}><RoleOptions/></select></label>
        <label className="admin-check"><input type="checkbox" checked={active} onChange={event=>setActive(event.target.checked)}/> Активная учётная запись</label>
        <button type="submit" className="run-control" disabled={role===user.role&&active===user.isActive}>Сохранить настройки</button>
      </fieldset>
    </form>
    <section className="admin-service-access" aria-labelledby="user-services-title">
      <h3 id="user-services-title">Доступ к сервисам</h3>
      <p>Сервер не возвращает список назначений. Здесь видны подтверждённые в этой сессии управления выдачи и отзывы.</p>
      {user.role==='admin'&&<p>Для этой роли сервер проверяет доступ по политике администратора. Индивидуальные назначения показаны отдельно.</p>}
      <input type="search" aria-label="Поиск сервиса" placeholder="Поиск по названию сервиса" value={query} onChange={event=>setQuery(event.target.value)}/>
      {message&&<p ref={feedback} tabIndex={-1} className="admin-feedback" role="status">{message}</p>}
      {error&&<p ref={feedback} tabIndex={-1} className="admin-feedback admin-error" role="alert">{error}</p>}
      {busy&&<p role="status">Сохраняем изменения…</p>}
      {groups.map(group=>group.services.length>0&&<section className="admin-grant-group" key={group.title} aria-label={group.title}>
        <h4>{group.title}</h4><ul>{group.services.map(service=><li key={service.id}>
          <div><strong>{service.name}</strong><small>{grants[service.id]===true?'Персональный доступ выдан':
            grants[service.id]===false?'Персональный доступ отозван':'Назначение неизвестно'}</small></div>
          <div className="admin-grant-actions">
            {grants[service.id]!==true&&<button type="button" className="run-control" disabled={busy}
              aria-label={`Выдать доступ: ${service.name}`} onClick={()=>onGrant(service.id,true)}>Выдать</button>}
            {grants[service.id]!==false&&<button type="button" className="run-control" disabled={busy}
              aria-label={`Отозвать доступ: ${service.name}`} onClick={()=>onGrant(service.id,false)}>Отозвать</button>}
          </div>
        </li>)}</ul>
      </section>)}
      {!visible.length&&<p>{query?'Сервисы не найдены.':'Нет доступных сервисов в каталоге.'}</p>}
    </section>
  </AdminDialog>;
}

export function AdminUsers({auth,services,onClose}:Props) {
  const [revision,setRevision]=useState(0);
  const [selected,setSelected]=useState<Account|null>(null);
  const [created,setCreated]=useState<Account|null>(null);
  const [adding,setAdding]=useState(false);
  const [query,setQuery]=useState('');
  const [grants,setGrants]=useState<Record<string,Record<string,boolean>>>({});
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');
  const pending=useRef(false);
  const returnFocus=useRef<HTMLElement|null>(null);
  const addButton=useRef<HTMLButtonElement>(null);
  const result=useBackendRead(String(revision),listUsers);
  const users=result.data?.filter(user=>user.username.toLocaleLowerCase('ru').includes(query.trim().toLocaleLowerCase('ru')))??[];

  function select(user:Account,trigger=document.activeElement as HTMLElement|null){
    returnFocus.current=trigger;
    setSelected(user);setError('');setMessage('');
  }

  function closeCard(){
    setSelected(null);
    requestAnimationFrame(()=>{
      if(returnFocus.current?.isConnected)returnFocus.current.focus();
      else addButton.current?.focus();
    });
  }

  function closeAdd(){
    setAdding(false);
    requestAnimationFrame(()=>addButton.current?.focus());
  }

  async function change(action:Mutation){
    if(pending.current)return;
    const current=auth.getCurrent();
    if(!canManageUsers(current.session)||current.revision!==auth.revision||current.pending){
      setError('Для этого действия нужна действующая сессия администратора.');
      return;
    }
    pending.current=true;setBusy(true);setError('');setMessage('');
    try {await action(current.session.csrfToken)}
    catch(failure){
      if(failure instanceof ApiError&&failure.status===401)void auth.restore();
      setError(failure instanceof ApiError&&failure.status===409?'Сервер отклонил изменение из-за конфликта. Проверьте данные.':
        failure instanceof Error?analyticsError(failure):'Не удалось сохранить изменения.');
    } finally {pending.current=false;setBusy(false)}
  }

  function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    const form=event.currentTarget;
    const values=new FormData(form);
    const passwordField=form.elements.namedItem('password') as HTMLInputElement;
    void change(async token=>{
      try {
        setCreated(await createUser({username:String(values.get('username')),password:passwordField.value,role:values.get('role') as Role},token));
        closeAdd();setRevision(value=>value+1);
      } finally {passwordField.value=''}
    });
  }

  return <main className="analytics-main admin-main">
    <button className="run-control admin-back" type="button" onClick={onClose}><AccountIcon name="back"/>К аналитике</button>
    <div className="admin-page-heading">
      <div><h1>Управление пользователями</h1><p>Учётные записи и доступ к сервисам</p></div>
      <button ref={addButton} type="button" className="run-control run-control-primary" onClick={()=>{setError('');setAdding(true)}}>Добавить пользователя</button>
    </div>
    {created&&<div className="admin-created"><span role="status">Пользователь {created.username} создан.</span>
      <button type="button" className="run-control" onClick={()=>select(created)}>Открыть карточку</button></div>}
    <section className="content-panel admin-users-list" aria-label="Пользователи">
      <div className="admin-list-tools">
        <input type="search" value={query} onChange={event=>setQuery(event.target.value)} aria-label="Поиск по логину" placeholder="Поиск по логину"/>
        <button className="run-control" type="button" disabled={result.loading} onClick={()=>setRevision(value=>value+1)}>Обновить</button>
      </div>
      {result.loading?<p role="status">Загружаем пользователей…</p>:result.error?<p role="alert">{analyticsError(result.error)}</p>:
        users.length?<div className="table-scroll"><table aria-label="Пользователи">
          <thead><tr><th scope="col">Логин</th><th scope="col">Роль</th><th scope="col">Статус</th>
            <th scope="col" title="Количество доступов текущий API не возвращает">Доступ к сервисам</th><th scope="col">Действие</th></tr></thead>
          <tbody>{users.map(user=>{
            const count=Object.values(grants[user.id]??{}).filter(Boolean).length;
            return <tr key={user.id} className={selected?.id===user.id?'selected':undefined} onClick={event=>select(user,event.currentTarget.querySelector('button'))}>
              <td><strong>{user.username}</strong></td><td>{roleNames[user.role]}</td><td><Status active={user.isActive}/></td>
              <td>{count>0?`Подтверждено: ${count}`:'Неизвестно'}</td>
              <td><button type="button" className="run-control" aria-label={`Открыть карточку: ${user.username}`}
                onClick={event=>{event.stopPropagation();select(user)}}>Открыть</button></td>
            </tr>;
          })}</tbody>
        </table></div>:<p>{query?'Пользователи с таким логином не найдены.':'Пользователей пока нет.'}</p>}
    </section>
    {selected&&<UserCard key={selected.id} user={selected} services={services} grants={grants[selected.id]??{}} busy={busy}
      error={error} message={message} change={change} onClose={closeCard}
      onUpdate={user=>{
        setSelected(user);setCreated(current=>current?.id===user.id?user:current);
        setRevision(value=>value+1);setMessage('Настройки пользователя сохранены.');
        if(user.id===auth.session?.user.id)void auth.restore();
      }}
      onGrant={(serviceId,granted)=>void change(async token=>{
        await setServiceAccess(selected.id,serviceId,granted,token);
        setGrants(current=>({...current,[selected.id]:{...current[selected.id],[serviceId]:granted}}));
        setMessage(granted?'Доступ выдан.':'Персональный доступ отозван.');
      })}/>}
    {adding&&<AdminDialog id="add-user-title" title="Добавить пользователя" busy={busy} onClose={closeAdd}>
      <form className="admin-form admin-create-form" onSubmit={submit} aria-busy={busy}>
        <fieldset disabled={busy}>
          <label>Логин<input name="username" required maxLength={100} pattern="[a-z][a-z0-9_.\x2d]*" autoCapitalize="none" autoComplete="off" autoFocus/></label>
          <label>Пароль<input type="password" name="password" required minLength={12} maxLength={128} autoComplete="new-password"/><small>От 12 до 128 символов.</small></label>
          <label>Роль<select name="role"><RoleOptions/></select></label>
        </fieldset>
        {error&&<p className="admin-feedback admin-error" role="alert">{error}</p>}
        <div className="create-service-actions">
          <button type="button" disabled={busy} onClick={closeAdd}>Отмена</button>
          <button type="submit" className="primary" disabled={busy}>{busy?'Создаём…':'Создать пользователя'}</button>
        </div>
      </form>
    </AdminDialog>}
  </main>;
}
