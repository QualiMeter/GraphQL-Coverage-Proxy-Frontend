import type {RequestOut} from '../api/runAnalytics';
import {millisValue,operationLabel} from './runAnalyticsModel';
import './requestJournal.css';

export const requestAnalysisLabels:Record<string,string>={
 success:'Успешно',parse_error:'Ошибка разбора',validation_error:'Ошибка валидации',
 unsupported:'Не поддерживается',internal_error:'Внутренняя ошибка',
};
const kindLabels:Record<string,string>={query:'Query',mutation:'Mutation',subscription:'Subscription'};
const date=(value:string)=>new Date(value).toLocaleString('ru-RU',{dateStyle:'short',timeStyle:'medium'});

export function RequestsTable({rows,selection,onSelect}:{rows:RequestOut[];selection:string;onSelect:(id:string)=>void}){
 return <div className="table-scroll requests-table-scroll" role="region" aria-label="Таблица обращений" tabIndex={0}>
  <table className="requests-table" aria-label="Обращения прогона">
   <colgroup><col style={{width:'17%'}}/><col style={{width:'23%'}}/><col style={{width:'12%'}}/><col style={{width:'8%'}}/><col style={{width:'13%'}}/><col style={{width:'12%'}}/><col style={{width:'15%'}}/></colgroup>
   <thead><tr><th>Дата и время</th><th>Операция</th><th>Тип</th><th>HTTP</th><th>GraphQL-ошибки</th><th className="request-duration">Длительность</th><th>Анализ</th></tr></thead>
   <tbody>{rows.map(row=><tr key={row.id} className={selection===row.id?'selected':undefined} onClick={()=>onSelect(row.id)}>
    <td><time dateTime={row.createdAt}>{date(row.createdAt)}</time></td>
    <td><button type="button" className="request-operation-name" aria-current={selection===row.id?'true':undefined} onClick={event=>{event.stopPropagation();onSelect(row.id)}}>{operationLabel(row.operationName)}</button></td>
    <td><span className="request-kind" data-kind={row.operationType??'unknown'}>{row.operationType?kindLabels[row.operationType]??row.operationType:'—'}</span></td>
    <td><span className="request-status" data-tone={row.httpStatus!==null&&row.httpStatus>=500?'error':row.httpStatus!==null&&row.httpStatus>=400?'warning':row.httpStatus!==null&&row.httpStatus>=200&&row.httpStatus<300?'good':'neutral'}>{row.httpStatus??'—'}</span></td>
    <td><span className="request-status" data-tone={row.graphqlHasErrors===true?'error':'neutral'}>{row.graphqlHasErrors===null?'Неизвестно':row.graphqlHasErrors?'Есть':'Нет'}</span></td>
    <td className="request-duration">{row.durationMs===null?'—':<><span>{millisValue(row.durationMs)}</span>{' '}<small>мс</small></>}</td>
    <td><span className="request-status" data-tone={row.analysisStatus==='success'?'good':['parse_error','validation_error','internal_error'].includes(row.analysisStatus)?'error':row.analysisStatus==='unsupported'?'warning':'neutral'}>{requestAnalysisLabels[row.analysisStatus]??row.analysisStatus}</span></td>
   </tr>)}</tbody>
  </table>
 </div>;
}
