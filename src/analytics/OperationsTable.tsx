import {millisValue} from './runAnalyticsModel';
import {ActionTooltip} from './ActionTooltip';
import './operationsTable.css';
import {OperationIdentity} from './OperationIdentity';

type OperationRow = {
  id:string;
  name:string;
  kind:'query'|'mutation'|'subscription';
  count:number;
  httpErrors:number;
  graphqlErrors:number;
  averageMs:number|null;
  fieldCount:number;
  anonymous?:boolean;
};

const kindLabels = {query:'Query', mutation:'Mutation', subscription:'Subscription'};
const columns = [
  {label:'Операция',width:'25%'},
  {label:'Тип',width:'12%'},
  {label:'Обращений',width:'11%'},
  {label:'HTTP-ошибки',width:'14%'},
  {label:'GraphQL-ошибки',width:'14%'},
  {label:'Среднее время',width:'15%'},
  {label:'Полей',width:'9%'},
];
const fieldsHint = 'Количество различных полей схемы, затронутых учтёнными обращениями этой операции за выбранный прогон';

export function OperationsTable({rows,selectedId,onSelect}:{
  rows:OperationRow[];selectedId?:string;onSelect:(id:string)=>void;
}) {
  return <div className="table-scroll operations-table-scroll" role="region" aria-label="Таблица операций" tabIndex={0}>
    <table className="operations-table" aria-label="Операции прогона">
      <colgroup>{columns.map(({label,width})=><col key={label} style={{width}}/>)}</colgroup>
      <thead><tr>{columns.map(({label})=>label==='Полей'?
        <th key={label} scope="col" aria-label={label}>
          <div className="operations-fields-heading"><span>{label}</span><ActionTooltip label={fieldsHint}>
            <button type="button" className="operations-fields-info" aria-label={fieldsHint}>
              <svg aria-hidden="true" width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round">
                <circle cx="8" cy="8" r="6"/>
                <path d="M8 7.5v3.25m0-5.5h.01"/>
              </svg>
            </button>
          </ActionTooltip></div>
        </th>:<th key={label} scope="col">{label}</th>)}</tr></thead>
      <tbody>{rows.map(row=><tr key={row.id} className={row.id===selectedId?'selected':undefined} onClick={()=>onSelect(row.id)}>
        <td><button className="operation-name" type="button" aria-current={row.id===selectedId?'true':undefined}>{row.name}</button>{row.anonymous&&<OperationIdentity operationKey={row.id}/>}</td>
        <td><span className="operation-kind" data-kind={row.kind}>{kindLabels[row.kind]}</span></td>
        <td className="operation-count">{row.count}</td>
        <td className={row.httpErrors>0?'operation-error':'operation-zero'}>{row.httpErrors}</td>
        <td className={row.graphqlErrors>0?'operation-error':'operation-zero'}>{row.graphqlErrors}</td>
        <td>{row.averageMs===null?'—':<><span className="operation-duration">{millisValue(row.averageMs)}</span>{' '}<span className="operation-unit">мс</span></>}</td>
        <td>{row.fieldCount}</td>
      </tr>)}</tbody>
    </table>
  </div>;
}
