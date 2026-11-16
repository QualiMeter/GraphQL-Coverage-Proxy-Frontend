import {roles,type Account,type Role,type Session} from './auth';
import {requestJson} from './client';

export function canManageUsers(session:Session|null):session is Session {
  return Boolean(session?.user.role==='admin'&&session.user.isActive&&Date.parse(session.expiresAt)>Date.now());
}

function user(data:unknown): Account {
  if(data&&typeof data==='object'&&'id'in data&&typeof data.id==='string'&&
    'username'in data&&typeof data.username==='string'&&'role'in data&&roles.includes(data.role as Role)&&
    'isActive'in data&&typeof data.isActive==='boolean') {
    return {id:data.id,username:data.username,role:data.role as Role,isActive:data.isActive};
  }
  throw new Error('Expected UserOut');
}

export function listUsers(signal?:AbortSignal) {
  return requestJson('/api/auth/users',data=>{
    if(!Array.isArray(data))throw new Error('Expected UserOut[]');
    return data.map(user);
  },{signal});
}

export function createUser(input:{username:string;password:string;role:Role},csrfToken:string) {
  return requestJson('/api/auth/users',user,{method:'POST',body:input,csrfToken});
}

export function updateUser(id:string,input:{role:Role;isActive:boolean},csrfToken:string) {
  return requestJson(`/api/auth/users/${encodeURIComponent(id)}`,data=>{
    const result=user(data);
    if(result.id!==id)throw new Error('Expected updated UserOut');
    return result;
  },{method:'PATCH',body:input,csrfToken});
}

export function setServiceAccess(userId:string,serviceId:string,granted:boolean,csrfToken:string) {
  return requestJson(`/api/auth/users/${encodeURIComponent(userId)}/services/${encodeURIComponent(serviceId)}`,data=>{
    if(data!==undefined)throw new Error('Expected an empty response');
  },{method:granted?'PUT':'DELETE',csrfToken});
}
