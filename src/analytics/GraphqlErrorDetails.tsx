import {useState} from 'react';
import type {GraphqlErrorInfo} from '../api/graphqlErrors';
import './graphqlErrorDetails.css';
export function errorCountLabel(count:number){const last=count%10,lastTwo=count%100;return `${count} ${last===1&&lastTwo!==11?'ошибка':last>=2&&last<=4&&(lastTwo<12||lastTwo>14)?'ошибки':'ошибок'}`}
export function graphqlErrorSummary(info:GraphqlErrorInfo){return info.graphqlErrorCount==null?'Число неизвестно':info.graphqlErrorCount===0?'Нет ошибок':errorCountLabel(info.graphqlErrorCount)}
export function errorPath(path:(string|number)[]|null|undefined){
 if(!path?.length)return 'Путь не подтверждён';
 return path.reduce<string>((text,segment)=>typeof segment==='number'?`${text}[${segment}]`:`${text}${text?'.':''}${segment}`,'');
}
export function GraphqlErrorDetails({info,compact=false}:{info:GraphqlErrorInfo;compact?:boolean}){
 const availability=info.graphqlErrorDetailsAvailability??'unavailable',count=info.graphqlErrorCount;
 const rows=availability==='unavailable'?[]:info.graphqlErrorDetails??[];
 const [open,setOpen]=useState(count!=null&&count>0||rows.length>0||info.graphqlHasErrors===true);
 if(count===0)return <p className="graphql-error-none">GraphQL-ошибки не обнаружены.</p>;
 if(!rows.length&&availability!=='truncated')return <div className="graphql-error-unavailable"><p>{count!=null?`GraphQL: ${errorCountLabel(count)}. `:''}Подробности GraphQL-ошибок недоступны.</p>{count==null&&<p>Число ошибок неизвестно.{info.graphqlHasErrors===true?' В сохранённых метаданных отмечен признак GraphQL-ошибок.':''}</p>}</div>;
 return <details className={`graphql-error-details${compact?' compact':''}`} open={open} onToggle={event=>setOpen(event.currentTarget.open)}><summary>GraphQL-ошибки · {graphqlErrorSummary(info)}</summary>{availability==='truncated'&&<p className="graphql-error-limits">{count==null?'Общее число ошибок неизвестно':`Обнаружено: ${count}`}; доступно записей: {rows.length}. Backend ограничил часть сведений, включая возможное сокращение путей и позиций.</p>}<ol className="graphql-error-list">{rows.map((row,index)=><li key={index}><div className="graphql-error-code"><strong data-known={Boolean(row.code)}>{row.code??'Код недоступен'}</strong><small>Ошибка {index+1}</small></div><p>{row.safeMessage??'Сообщение недоступно'}</p><dl><div><dt>Путь</dt><dd><code>{errorPath(row.path)}</code></dd></div><div><dt>Позиции</dt><dd>{row.locations?.length?row.locations.map((location,i)=><span key={i}>строка {location.line}, столбец {location.column}{i<row.locations!.length-1?'; ':''}</span>):'Позиции не сохранены'}</dd></div></dl></li>)}</ol>{!rows.length&&<p>Записи ошибок недоступны.</p>}{rows.some(row=>row.locations?.length)&&<p className="graphql-error-location-note">Позиции относятся к исходному документу и могут не совпадать с безопасной копией.</p>}</details>;
}
