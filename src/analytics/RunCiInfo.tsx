import {pipelineLink} from '../api/gitlab';
import type {RunCi} from '../api/gitlabHistory';
export function RunCiInfo({ci,link=false}:{ci?:RunCi|null;link?:boolean}){
 if(!ci)return <small className="run-ci-empty">Нет данных CI</small>;
 const url=pipelineLink(ci.pipelineUrl);
 return <span className="run-ci-info"><span className="run-ci-branch">{ci.branch}</span>{ci.commitSha&&<code title={ci.commitSha}>{ci.commitSha.slice(0,8)}</code>}<small className="ci-pipeline-line">Pipeline #{ci.pipelineId} <b className="ci-status-badge" data-status={ci.pipelineStatus}>{ci.pipelineStatus}</b></small>{ci.environment&&<small>Окружение: {ci.environment}</small>}{link&&url&&<a href={url} target="_blank" rel="noopener noreferrer" onClick={event=>event.stopPropagation()}>Открыть в GitLab ↗</a>}</span>;
}
