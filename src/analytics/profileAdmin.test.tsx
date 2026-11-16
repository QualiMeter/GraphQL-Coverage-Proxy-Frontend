import {renderToStaticMarkup} from 'react-dom/server';
import {expect,it,vi} from 'vitest';
import {ProfileActions} from './AccountControl';
import {ThemeToggle} from './ThemeToggle';
import {canManageUsers} from '../api/admin';
import type {Session} from '../api/auth';

it('keeps the account actions ordered and exposes administration only to admins',()=>{
  const action=vi.fn();
  const props={onAdmin:action,onLogout:action,loggingOut:false,error:''};
  const viewer=renderToStaticMarkup(<ProfileActions {...props} role="viewer"/>);
  const admin=renderToStaticMarkup(<ProfileActions {...props} role="admin"/>);
  expect(viewer).not.toContain('Управление пользователями');
  expect(admin).not.toContain('Оформление');
  expect(viewer).not.toContain('Оформление');
  expect(viewer).toContain('Выйти');
  expect(admin).toContain('Управление пользователями');
  expect(admin.indexOf('Управление пользователями')).toBeLessThan(admin.indexOf('Выйти'));
});

it('labels the quick theme toggle with the action for each palette',()=>{
  expect(renderToStaticMarkup(<ThemeToggle dark={false} onToggle={vi.fn()}/>)).toContain('Включить тёмную тему');
  expect(renderToStaticMarkup(<ThemeToggle dark onToggle={vi.fn()}/>)).toContain('Включить светлую тему');
});

it('requires an active and unexpired administrator session for management',()=>{
  const session:Session={user:{id:'user',role:'admin',username:'admin',isActive:true},csrfToken:'local',
    expiresAt:new Date(Date.now()+60_000).toISOString()};
  expect(canManageUsers(session)).toBe(true);
  expect(canManageUsers({...session,user:{...session.user,role:'operator'}})).toBe(false);
  expect(canManageUsers({...session,user:{...session.user,isActive:false}})).toBe(false);
  expect(canManageUsers({...session,expiresAt:new Date(0).toISOString()})).toBe(false);
  expect(canManageUsers(null)).toBe(false);
});
