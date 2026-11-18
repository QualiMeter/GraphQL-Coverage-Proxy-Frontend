import {useState, type ButtonHTMLAttributes} from 'react';
import type {RunStats} from '../api/runAnalytics';
import {ActionTooltip} from './ActionTooltip';
import {ContextChevron} from './ContextMenu';
import {analysisErrors,millis} from './runAnalyticsModel';

type Props = {
  coverage:{totalFields:number;coveredFields:number;coveragePercent:number}|null;
  schemaFieldCount:number|null;stats?:RunStats;selected:boolean;
  refresh?:()=>void;loading:boolean;errors:string[];onMetric:(key:string)=>void;
};

type SummaryActionProps = Pick<ButtonHTMLAttributes<HTMLButtonElement>,
  'children'|'disabled'|'aria-controls'|'aria-expanded'|'onClick'> & {label:string};

function SummaryAction({label,children,...button}:SummaryActionProps) {
  return <ActionTooltip label={label}>
    <button {...button} type="button" className="run-control summary-icon-button" aria-label={label}>
      {children}
    </button>
  </ActionTooltip>;
}

function Metric({title,value,action,primary=false,hint}:{title:string;value:string|number;action?:()=>void;primary?:boolean;hint?:string}) {
  const content=<><span>{title}</span><strong>{value}</strong></>;
  const className=`summary-metric${primary?' summary-primary':''}`;
  return action?<button type="button" className={className} onClick={action} title={hint}>{content}</button>:
    <div className={className} title={hint}>{content}</div>;
}

const percent=new Intl.NumberFormat('ru-RU',{minimumFractionDigits:2,maximumFractionDigits:2});

export function AnalyticsSummary({coverage,schemaFieldCount,stats,selected,refresh,loading,errors,onMetric}:Props) {
  const [collapsed,setCollapsed]=useState(()=>localStorage.getItem('coverage.summary.collapsed')==='true');
  const value=coverage?`${percent.format(coverage.coveragePercent)}%`:'—';
  const total=stats?.totalRequests??'—';
  const measured=Boolean(stats);
  const metric=(title:string,value:string|number,key:string,hint?:string)=><Metric title={title} value={value}
    action={measured?()=>onMetric(key):undefined} hint={hint}/>;
  return <section className="workspace-summary" aria-label="Сводка прогона">
    <div className="summary-toolbar">
      <div className="summary-caption">{!selected?'Выберите прогон':collapsed?`Покрытие ${value} · Обращения ${total}`:'Сводка прогона'}
        {loading&&<span role="status"> · Обновление…</span>}
      </div>
      <div className="summary-actions">
        {refresh&&<SummaryAction label="Обновить аналитику и покрытие" onClick={refresh} disabled={loading}>
          <svg aria-hidden="true" className={loading?'summary-refresh-spinning':undefined} width="18" height="18"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8m0-5v5h-5M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16m5 0H3v5"/>
          </svg>
        </SummaryAction>}
        <SummaryAction label={collapsed?'Развернуть сводку':'Свернуть сводку'} aria-expanded={!collapsed} aria-controls="summary-metrics"
          onClick={()=>{localStorage.setItem('coverage.summary.collapsed',String(!collapsed));setCollapsed(!collapsed)}}>
          <ContextChevron up={!collapsed}/>
        </SummaryAction>
      </div>
    </div>
    {errors.length>0&&<div className="summary-error" role="alert">{errors.map(error=><div key={error}>{error}</div>)}</div>}
    <div id="summary-metrics" className="summary-metrics" hidden={collapsed}>
      <section className="summary-sheet">
        <h2>Покрытие схемы</h2>
        <div className="coverage-strip">
          <Metric title="Общее покрытие" value={value} action={coverage?()=>onMetric('coverage'):undefined} primary
            hint="Наблюдаемое использование полей GraphQL в запросах прогона."/>
          <Metric title="Покрыто" value={coverage?.coveredFields??'—'} action={coverage?()=>onMetric('covered'):undefined}/>
          <Metric title="Всего полей" value={schemaFieldCount??'—'}/>
          <Metric title="Не покрыто" value={coverage?coverage.totalFields-coverage.coveredFields:'—'} action={coverage?()=>onMetric('uncovered'):undefined}/>
        </div>
        <div className="summary-track"><i style={{width:coverage?`${coverage.coveragePercent}%`:0}}/></div>
      </section>
      <section className="summary-sheet">
        <h2>Результаты обращений</h2>
        <div className="summary-groups">
          <div className="summary-grouping"><h3>Активность</h3><div>
            {metric('Обращения',total,'requests')}
            {metric('Уникальные операции',stats?.uniqueOperations??'—','operations')}
          </div></div>
          <div className="summary-grouping"><h3>Ошибки</h3><div>
            {metric('HTTP-ошибки',stats?.httpErrorCount??'—','http')}
            {metric('GraphQL-ошибки',stats?.graphqlErrorCount??'—','graphql')}
            {metric('Ошибки анализа',stats?(analysisErrors(stats)??'—'):'—','analyzer')}
          </div></div>
          <div className="summary-grouping"><h3>Время ответа</h3><div>
            {metric('Среднее время',millis(stats?.avgDurationMs),'average')}
            {metric('P95',millis(stats?.p95DurationMs),'p95','95% измеренных обращений выполнялись не дольше указанного времени.')}
          </div></div>
        </div>
      </section>
    </div>
  </section>;
}
