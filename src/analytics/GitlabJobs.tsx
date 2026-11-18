import {useState} from 'react';
import {getGitlabJobs} from '../api/gitlabHistory';
import {pipelineLink} from '../api/gitlab';
import {useComparisonResource} from './useComparisonResource';
import {ComparisonStatus} from './ComparisonUi';
import {millis} from './runAnalyticsModel';
export function jobDuration(start:string|null,end:string|null){
 if(!start||!end)return '—';const duration=Date.parse(end)-Date.parse(start);
 return Number.isFinite(duration)&&duration>=0?millis(duration):'—';
}
export function GitlabJobs({runId,pipelineId,scope}:{runId:string;pipelineId:number;scope:string}){
 const [offset,setOffset]=useState(0);
 const resource=useComparisonResource(JSON.stringify([scope,runId,pipelineId,offset]),signal=>getGitlabJobs(runId,pipelineId,offset,signal));
 const page=resource.data;
 return <section className="history-ci-jobs" aria-label="CI jobs прогона"><div className="history-jobs-heading"><strong>CI jobs · Pipeline #{pipelineId}</strong><button type="button" className="run-control" disabled={resource.loading} onClick={resource.retry}>Обновить jobs</button></div><ComparisonStatus resource={resource}/>{page&&<>{page.jobsSyncedAt===null&&<p role="status">Полный проход синхронизации ещё не подтверждён. Список jobs может быть неполным.</p>}{!page.jobsFinalized&&<p role="status">Синхронизация jobs не завершена окончательно.</p>}{page.jobsSyncedAt&&<p>Обновлено: {new Date(page.jobsSyncedAt).toLocaleString('ru-RU')}</p>}{page.jobs.length?<div className="table-scroll"><table aria-label="CI jobs"><thead><tr><th>Job</th><th>Stage</th><th>Статус job</th><th>Длительность</th><th>GitLab</th></tr></thead><tbody>{page.jobs.map(job=>{const url=pipelineLink(job.url);return <tr key={job.jobId}><td>{job.name}<small>#{job.jobId}</small></td><td>{job.stage}</td><td>{job.status}</td><td>{jobDuration(job.startedAt,job.finishedAt)}</td><td>{url?<a href={url} target="_blank" rel="noopener noreferrer">Открыть job ↗</a>:'Ссылка недоступна'}</td></tr>})}</tbody></table></div>:<p>Нет сохранённых CI jobs.</p>}<div className="run-history-pagination"><button type="button" className="run-control" disabled={!offset} onClick={()=>setOffset(Math.max(0,offset-100))}>Предыдущие jobs</button><span>Всего jobs: {page.total} · Страница {offset/100+1}</span><button type="button" className="run-control" disabled={offset+page.jobs.length>=page.total||!page.jobs.length} onClick={()=>setOffset(offset+100)}>Следующие jobs</button></div><small>CI jobs — задания pipeline; E2E-тесты находятся во вкладке «Тесты».</small></>}</section>;
}
