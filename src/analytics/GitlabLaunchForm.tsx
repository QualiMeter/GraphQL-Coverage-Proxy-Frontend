import {useRef,useState,type FormEvent} from 'react';
import {gitlabErrorRunId,gitlabBranches,gitlabErrorMessage,launchNeedsHistory,pipelineLink,type GitlabPipeline} from '../api/gitlab';
import {useComparisonResource} from './useComparisonResource';
import './gitlab.css';

export function GitlabLaunchForm({serviceId,serviceName,snapshotName,onLaunch,onBusy,onLock,onClose,onHistory}:{serviceId:string;serviceName:string;snapshotName:string;onLaunch:(ref:string,name?:string)=>Promise<GitlabPipeline|null>;onBusy:(busy:boolean)=>void;onLock:()=>void;onClose:()=>void;onHistory:()=>void}){
 const [page,setPage]=useState(1),[previous,setPrevious]=useState<string[]>([]),[query,setQuery]=useState(''),[ref,setRef]=useState(''),[name,setName]=useState(''),[busy,setBusy]=useState(false),[blocked,setBlocked]=useState(false),[error,setError]=useState(''),[created,setCreated]=useState<GitlabPipeline|null>(null),[runId,setRunId]=useState<string|null>(null);
 const branches=useComparisonResource(JSON.stringify([serviceId,page]),signal=>gitlabBranches(serviceId,page,signal));
 const loaded=[...new Set([...previous,...(branches.data??[])])];
 const filtered=loaded.filter(branch=>branch.toLowerCase().includes(query.trim().toLowerCase()));
 const inFlight=useRef(false);
 async function submit(event:FormEvent){
  event.preventDefault();
  if(inFlight.current||blocked||!loaded.includes(ref))return;
  inFlight.current=true;setBusy(true);onBusy(true);setError('');
  try{
   const result=await onLaunch(ref,name.trim()||undefined);
   onLock();setBlocked(true);
   if(result){setCreated(result);setRunId(result.runId)}
  }catch(failure){
   const id=gitlabErrorRunId(failure);if(id)setRunId(id);
   if(launchNeedsHistory(failure)){setBlocked(true);onLock()}
   setError(gitlabErrorMessage(failure));
  }finally{inFlight.current=false;setBusy(false);onBusy(false)}
 }
 const url=created?pipelineLink(created.pipelineUrl):null;
 return <form onSubmit={submit}><dl className="run-dialog-context"><div><dt>Сервис</dt><dd>{serviceName}</dd></div><div><dt>Снимок схемы</dt><dd>{snapshotName}</dd></div></dl>{created?<><p role="status">Запрос принят. Coverage Run: <code>{created.runId}</code></p><p>GitLab pipeline: {created.pipelineStatus}. Его состояние и покрытие отслеживаются в интерфейсе прогона.</p>{created.pipelineStatus==='launch_unknown'&&<p>Исход запуска неизвестен; выполняется сверка. Не запускайте повторно.</p>}{url&&<a href={url} target="_blank" rel="noopener noreferrer">Открыть в GitLab ↗</a>}</>:<><label htmlFor="gitlab-branch-search">Поиск среди загруженных веток</label><input id="gitlab-branch-search" value={query} onChange={e=>setQuery(e.target.value)} disabled={busy||blocked} placeholder="Название ветки"/><label htmlFor="gitlab-ref">Ветка GitLab</label><select id="gitlab-ref" value={ref} onChange={e=>setRef(e.target.value)} disabled={busy||blocked}><option value="">Выберите ветку</option>{ref&&!filtered.includes(ref)&&<option value={ref}>{ref} (выбрана)</option>}{filtered.map(branch=><option key={branch} value={branch}>{branch}</option>)}</select>
  {branches.loading&&<p role="status">Загружаем ветки…</p>}{branches.error&&<div role="alert"><p className="form-error">{gitlabErrorMessage(branches.error)}</p><button type="button" className="run-control" disabled={busy||blocked} onClick={branches.retry}>Повторить загрузку веток</button></div>}{branches.data&&loaded.length===0&&<p>GitLab вернул пустой список веток.</p>}{loaded.length>0&&filtered.length===0&&<p>Среди {loaded.length} загруженных веток совпадений нет.</p>}{branches.data?.length===100&&page<10000&&<button type="button" className="run-control" disabled={busy||blocked} onClick={()=>{setPrevious(loaded);setPage(page+1)}}>Загрузить следующие ветки</button>}
  <label htmlFor="gitlab-run-name">Название прогона (необязательно)</label><input id="gitlab-run-name" maxLength={255} value={name} onChange={e=>setName(e.target.value)} disabled={busy||blocked} placeholder="E2E Regression"/>
 </>}{error&&<p className="form-error" role="alert">{error}</p>}{runId&&!created&&<p>Создан Coverage Run <code>{runId}</code>. Состояние будет проверено без повторного запуска.</p>}{blocked&&!created&&<p>Перед новым запуском проверьте историю: запрос мог создать прогон и pipeline.</p>}{busy&&<p role="status">Отправляем один запрос запуска E2E…</p>}<div className="run-dialog-actions"><button type="button" className="run-control" disabled={busy} onClick={onClose}>{created?'К прогону':'Закрыть'}</button>{blocked&&<button type="button" className="run-control" disabled={busy} onClick={onHistory}>Проверить историю</button>}{!created&&<button type="submit" className="run-control run-control-primary" disabled={busy||blocked||!loaded.includes(ref)||[...name.trim()].length>255}>Запустить E2E-тесты</button>}</div></form>;
}
