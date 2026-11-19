// @vitest-environment jsdom
import {act,useEffect,useState} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {ApiError} from '../api/client';
import {findRun,listRuns,runPageSize,type RunOut} from '../api/runs';
import {resolveServiceRun} from './autoRunSelection';
import {useAutoRunSelection} from './useAutoRunSelection';
import {readWorkspace,readRunPreference,rememberRun,saveWorkspace,workspaceOwner} from './workspaceSelection';
import {selectedRun,type RunSelection} from './backendRuns';
vi.mock('../api/runs',async original=>({...await original<object>(),findRun:vi.fn(),listRuns:vi.fn()}));
const id=(n:number)=>`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
const A=id(1),B=id(2),oldSnapshot=id(3),newSnapshot=id(4),owner=workspaceOwner(id(5));
const snapshots=[{id:newSnapshot},{id:oldSnapshot}];
const run=(n:number,snapshotId=oldSnapshot,status='running'):RunOut=>({id:id(n),snapshotId,status,name:`Run ${n}`,startedAt:'2026-11-18T12:00:00Z',finishedAt:null});
const find=vi.mocked(findRun),list=vi.mocked(listRuns);
const page=(runs:RunOut[]=[],hasMore=false)=>({runs,hasMore});
const resolve=(saved:ReturnType<typeof readRunPreference>=null,available=snapshots)=>resolveServiceRun(A,available,saved,new AbortController().signal);
function deferred<T>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(done=>{resolve=done});return {promise,resolve}}
let root:Root|undefined,container:HTMLDivElement;
beforeEach(()=>{vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);localStorage.clear();find.mockReset().mockResolvedValue(null);list.mockReset().mockResolvedValue(page());container=document.createElement('div');document.body.append(container)});
afterEach(async()=>{if(root)await act(async()=>root!.unmount());root=undefined;container.remove();vi.unstubAllGlobals();vi.restoreAllMocks()});
it('selects the newest active run using one service-scoped, sorted page',async()=>{
 const active=run(10);list.mockResolvedValueOnce(page([active,run(11)],true));
 expect(await resolve()).toEqual(active);expect(list).toHaveBeenCalledTimes(1);
 expect(list).toHaveBeenCalledWith({serviceId:A},0,expect.any(AbortSignal),{status:'running',sortBy:'startedAt',sortOrder:'desc'});
 expect(find).not.toHaveBeenCalled();
});
it('falls back to newest available run when there are no active runs',async()=>{
 const completed=run(12,newSnapshot,'completed');list.mockResolvedValueOnce(page()).mockResolvedValueOnce(page([completed]));
 expect(await resolve()).toEqual(completed);expect(list.mock.calls[1][3]).toEqual({status:undefined,sortBy:'startedAt',sortOrder:'desc'});
});
it('restores an explicit completed run and its older snapshot before looking for newer runs',async()=>{
 const saved=run(13,oldSnapshot,'completed');find.mockResolvedValueOnce(saved);
 expect(await resolve({runId:saved.id,snapshotId:oldSnapshot})).toEqual(saved);expect(list).not.toHaveBeenCalled();
});
it.each([null,403,404])('falls back from a deleted or inaccessible favorite (%s)',async status=>{
 const favorite={runId:id(13),snapshotId:oldSnapshot};
 if(status)find.mockRejectedValueOnce(new ApiError('http','Unavailable',status));
 const fallback=run(14);list.mockResolvedValueOnce(page([fallback]));expect(await resolve(favorite)).toEqual(fallback);
});
it('skips runs with inaccessible snapshots and reads further only when necessary',async()=>{
 list.mockResolvedValueOnce(page([run(15,id(99))],true)).mockResolvedValueOnce(page([run(16)]));
 expect(await resolve({runId:id(13),snapshotId:id(99)})).toEqual(run(16));expect(find).not.toHaveBeenCalled();expect(list.mock.calls[1][1]).toBe(runPageSize);
});
it('returns no run for a service without runs',async()=>{expect(await resolve()).toBeNull();expect(list).toHaveBeenCalledTimes(2)});
it.each([401,500])('surfaces API errors instead of treating them as empty history (%s)',async status=>{
 const failure=new ApiError('http','Failure',status);list.mockRejectedValueOnce(failure);await expect(resolve()).rejects.toBe(failure);
});
it('does not fall back on a temporary failure restoring a favorite',async()=>{
 find.mockRejectedValueOnce(new ApiError('http','Temporary',500));await expect(resolve({runId:id(13),snapshotId:oldSnapshot})).rejects.toMatchObject({status:500});expect(list).not.toHaveBeenCalled();
});
it('keeps explicit choices per service across fresh storage reads and automatic saves',()=>{
 const favoriteA={runId:id(20),snapshotId:oldSnapshot},favoriteB={runId:id(21),snapshotId:newSnapshot};
 rememberRun(owner,A,favoriteA);rememberRun(owner,B,favoriteB);
 saveWorkspace({serviceId:A,snapshotId:newSnapshot,runId:id(22)},owner);
 expect(readRunPreference(owner,A)).toEqual(favoriteA);expect(readRunPreference(owner,B)).toEqual(favoriteB);
 expect(readWorkspace(owner)).toEqual({serviceId:A,snapshotId:newSnapshot,runId:id(22)});
 saveWorkspace({serviceId:A,snapshotId:newSnapshot,runId:null},owner);expect(readRunPreference(owner,A)).toEqual(favoriteA);
});
it('isolates accounts and anonymous settings and ignores legacy settings with unknown owner',()=>{
 localStorage.setItem('graphql-coverage.workspace',JSON.stringify({serviceId:A,runId:id(20),snapshotId:oldSnapshot}));
 rememberRun(owner,A,{runId:id(20),snapshotId:oldSnapshot});
 for(const other of [workspaceOwner(id(6)),workspaceOwner(null)]){expect(readWorkspace(other)).toBeNull();expect(readRunPreference(other,A)).toBeNull()}
});
it('tolerates malformed or blocked local storage',()=>{
 localStorage.setItem(`graphql-coverage.workspace.v2.${encodeURIComponent(owner)}`,'{');expect(readWorkspace(owner)).toBeNull();
 vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new Error('Blocked')});expect(()=>rememberRun(owner,A,{runId:id(20),snapshotId:oldSnapshot})).not.toThrow();
});
let controls:ReturnType<typeof useAutoRunSelection>;
function Harness({service=A,scope='A:0',user=owner,enabled=true,ready=true}:{service?:string;scope?:string;user?:string;enabled?:boolean;ready?:boolean}){
 const [selection,setSelection]=useState<RunSelection|null>(null),[snapshot,setSnapshot]=useState(newSnapshot);
 controls=useAutoRunSelection({owner:user,serviceId:service,scope,snapshots:[...snapshots],ready,enabled,onResolve:run=>{setSnapshot(run?.snapshotId??newSnapshot);setSelection(run?{scope,run}:null)}});
 const active=selectedRun(selection,scope,snapshot);
 useEffect(()=>{if(controls.resolved&&enabled)saveWorkspace({serviceId:service,snapshotId:snapshot,runId:active?.id??null},user)},[service,snapshot,active?.id,user,enabled,controls.resolved]);
 return <><output>{JSON.stringify({run:active?.id??null,snapshot,loading:controls.loading,error:controls.error?.message})}</output><button onClick={()=>{controls.cancel();rememberRun(user,service,{runId:id(30),snapshotId:newSnapshot});setSelection({scope,run:run(30,newSnapshot)})}}>Manual</button></>;
}
async function render(props:Parameters<typeof Harness>[0]={}){await act(async()=>{root??=createRoot(container);root.render(<Harness {...props}/>)});}
const output=()=>JSON.parse(container.querySelector('output')!.textContent!);
it('waits for snapshots without overwriting storage, then selects run and snapshot together',async()=>{
 rememberRun(owner,A,{runId:id(20),snapshotId:oldSnapshot});const before=localStorage.getItem(localStorage.key(0)!);find.mockResolvedValue(run(20));
 await render({ready:false});expect(list).not.toHaveBeenCalled();expect(localStorage.getItem(localStorage.key(0)!)).toBe(before);
 await render();expect(output()).toMatchObject({run:id(20),snapshot:oldSnapshot,loading:false});expect(list).not.toHaveBeenCalled();
});
it('uses latest snapshot without coverage when no runs exist',async()=>{await render();expect(output()).toMatchObject({run:null,snapshot:newSnapshot,loading:false})});
it('aborts automatic lookup and ignores its late result after manual selection',async()=>{
 const pending=deferred<Awaited<ReturnType<typeof listRuns>>>();list.mockReturnValueOnce(pending.promise);await render();const signal=list.mock.calls[0][2]!;
 await act(async()=>container.querySelector('button')!.click());expect(signal.aborted).toBe(true);
 await act(async()=>pending.resolve(page([run(31)])));expect(output().run).toBe(id(30));expect(readRunPreference(owner,A)?.runId).toBe(id(30));
});
it('rejects late A and B responses during A → B → A and does not repeat requests on rerender',async()=>{
 const first=deferred<Awaited<ReturnType<typeof listRuns>>>(),second=deferred<Awaited<ReturnType<typeof listRuns>>>();
 list.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise).mockResolvedValueOnce(page([run(32)]));
 await render();const signal=list.mock.calls[0][2]!;await render({service:B,scope:'B:1'});expect(signal.aborted).toBe(true);
 await render({scope:'A:2'});expect(output().run).toBe(id(32));
 await act(async()=>{first.resolve(page([run(33)]));second.resolve(page([run(34)]))});expect(output().run).toBe(id(32));
 await render({scope:'A:2'});expect(list).toHaveBeenCalledTimes(3);
});
it('does not transfer an old response or favorite across session changes',async()=>{
 const pending=deferred<Awaited<ReturnType<typeof listRuns>>>();list.mockReturnValueOnce(pending.promise).mockResolvedValueOnce(page([run(35)]));
 await render();await render({user:workspaceOwner(id(6)),scope:'session:1'});
 await act(async()=>pending.resolve(page([run(36)])));expect(output().run).toBe(id(35));expect(readRunPreference(workspaceOwner(id(6)),A)).toBeNull();
});
it('keeps favorite on error, allows retry, and never saves a premature null',async()=>{
 rememberRun(owner,A,{runId:id(20),snapshotId:oldSnapshot});const before=localStorage.getItem(localStorage.key(0)!);
 find.mockRejectedValueOnce(new ApiError('http','Temporary failure',500));await render();expect(output().error).toBe('Temporary failure');expect(localStorage.getItem(localStorage.key(0)!)).toBe(before);
 find.mockResolvedValueOnce(run(20));await act(async()=>controls.retry());expect(output()).toMatchObject({run:id(20),snapshot:oldSnapshot,loading:false});expect(readRunPreference(owner,A)?.runId).toBe(id(20));
});
it('pauses and aborts lookup while authentication changes',async()=>{
 const pending=deferred<Awaited<ReturnType<typeof listRuns>>>();list.mockReturnValueOnce(pending.promise).mockResolvedValueOnce(page([run(37)]));
 await render();const signal=list.mock.calls[0][2]!;await render({enabled:false});expect(signal.aborted).toBe(true);
 await act(async()=>pending.resolve(page([run(38)])));expect(output().run).toBeNull();await render();expect(output().run).toBe(id(37));
});
