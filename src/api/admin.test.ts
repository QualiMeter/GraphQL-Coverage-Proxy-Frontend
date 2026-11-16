import {afterEach,expect,it,vi} from 'vitest';
import {createUser,listUsers,setServiceAccess,updateUser} from './admin';

const account={id:'user',username:'operator-one',role:'operator',isActive:true} as const;
afterEach(()=>vi.unstubAllGlobals());

it('decodes user records without retaining extra fields and reports access failures',async()=>{
  const fetch=vi.fn().mockResolvedValueOnce(Response.json([{...account,password:'ignored'}]))
    .mockResolvedValueOnce(new Response(null,{status:403}));
  vi.stubGlobal('fetch',fetch);
  await expect(listUsers()).resolves.toEqual([account]);
  await expect(listUsers()).rejects.toMatchObject({status:403});
});

it('creates a user and updates only the documented account fields with CSRF',async()=>{
  const fetch=vi.fn().mockResolvedValueOnce(Response.json(account,{status:201}))
    .mockResolvedValueOnce(Response.json({...account,role:'viewer',isActive:false}));
  vi.stubGlobal('fetch',fetch);
  await createUser({username:account.username,password:'fixture-password',role:'operator'},'test-csrf');
  await updateUser(account.id,{role:'viewer',isActive:false},'test-csrf');
  expect(fetch.mock.calls.map(([path,options])=>[path,options.method,options.headers.get('X-CSRF-Token')])).toEqual([
    ['/api/auth/users','POST','test-csrf'],['/api/auth/users/user','PATCH','test-csrf'],
  ]);
  expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({role:'viewer',isActive:false});
});

it('uses idempotent PUT and DELETE for one service grant',async()=>{
  const fetch=vi.fn().mockImplementation(()=>Promise.resolve(new Response(null,{status:204})));
  vi.stubGlobal('fetch',fetch);
  await setServiceAccess(account.id,'service',true,'test-csrf');
  await setServiceAccess(account.id,'service',false,'test-csrf');
  expect(fetch.mock.calls.map(([path,options])=>[path,options.method,options.body,options.credentials])).toEqual([
    ['/api/auth/users/user/services/service','PUT',undefined,'same-origin'],
    ['/api/auth/users/user/services/service','DELETE',undefined,'same-origin'],
  ]);
});
