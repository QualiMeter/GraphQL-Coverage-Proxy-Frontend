import {gitlabErrorMessage,gitlabCodeMessage,pipelineLink} from '../api/gitlab';
import type {useGitlabPipeline} from './useGitlabPipeline';
import {runStatus} from './backendRuns';
import './gitlab.css';

export function GitlabRunStatus({state,requests,coverage}:{state:ReturnType<typeof useGitlabPipeline>;requests?:number;coverage?:number|null}){
 const data=state.data;
 if(!data&&!state.loading&&!state.error)return null;
 const url=data?pipelineLink(data.pipelineUrl):null;
 return <section className="gitlab-status" aria-label="GitLab CI"><div><strong>GitLab pipeline</strong>{state.loading&&<p role="status">Проверяем связь с GitLab…</p>}{data&&<><p>ID: {data.pipelineId??'Ещё не подтверждён'} · Статус: <b>{data.pipelineStatus}</b></p>{url&&<a href={url} target="_blank" rel="noopener noreferrer">Открыть в GitLab ↗</a>}{data.pipelineStatus==='launch_unknown'&&<p>Результат запуска пока неизвестен. Backend выполняет сверку; повторный запуск не отправляется.</p>}{data.errorCode&&<p className="gitlab-warning">{gitlabCodeMessage(data.errorCode)}</p>}</>}{state.error&&<div role="alert"><p>{gitlabErrorMessage(state.error)}{data?' Показан последний полученный статус.':''}</p><button type="button" className="run-control" onClick={state.retry}>Повторить чтение статуса</button></div>}</div>{data&&<div><strong>Coverage Run</strong><p>Сбор: <b>{runStatus(data.runStatus)}</b> · Обращения: {requests??'—'} · Покрытие: {coverage==null?'—':`${coverage.toLocaleString('ru-RU',{maximumFractionDigits:2})}%`}</p>{data.collectionIncomplete&&<p className="gitlab-warning">Неполный сбор. Сохранённые обращения доступны, но не представляют полный результат.</p>}<p>{data.trackingFinished?'Отслеживание завершено.':'Статус обновляется каждые 10 секунд.'} Жизненным циклом прогона управляет backend.</p></div>}</section>;
}
