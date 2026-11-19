import {useEffect,useId,useState} from 'react';
import {getRunPaths,pathLabel,type QueryPath,type SchemaCoordinate} from '../api/runPaths';
import {useComparisonResource} from './useComparisonResource';
import {analyticsError} from './runAnalyticsModel';
import './requestPaths.css';
import {MetricInfo} from './MetricInfo';
export function FieldPathItem({row,index,canSearch,onFind}:{row:QueryPath;index:number;canSearch:boolean;onFind:(path:SchemaCoordinate[])=>void}){
 return <details className="field-request-path"><summary>Путь {index+1} — {row.pathHits} обращений · Глубина {row.path.length}</summary><code>{pathLabel(row.path)}</code><ol>{row.path.map((c,n)=><li key={n}>{c.typeName}.{c.fieldName}</li>)}</ol><button type="button" onClick={()=>onFind(row.path)} disabled={!canSearch}>Найти обращения с этим путём</button></details>;
}
export function FieldRequestPaths({runId,snapshotId,field,scope,canSearch,onFind,onHighlightPath,embedded=false}:{runId?:string|null;snapshotId?:string|null;field:SchemaCoordinate;scope:string;canSearch:boolean;onFind:(path:SchemaCoordinate[])=>void;embedded?:boolean;onHighlightPath?:(path:SchemaCoordinate[]|null)=>void}){
 const [open,setOpen]=useState(false),[offset,setOffset]=useState(0),[previous,setPrevious]=useState<QueryPath[]>([]);
 useEffect(()=>()=>onHighlightPath?.(null),[onHighlightPath]);
 const [expanded,setExpanded]=useState<string|null>(null);
 const resource=useComparisonResource((open||embedded)&&runId&&snapshotId?JSON.stringify([scope,runId,snapshotId,field,offset]):null,signal=>getRunPaths(runId!,snapshotId!,field,offset,signal));
 const page=resource.data,rows=[...new Map([...previous,...(page?.paths.items??[])].map(p=>[JSON.stringify(p.path),p])).values()];
 if(embedded)return <section className="object-field-paths"><h3>Пути обращения к полю <MetricInfo text="pathHits — число обращений, для которых сохранилась данная цепочка выбранных GraphQL-полей. Это не то же самое, что Coverage Hits или число вызовов resolver."/></h3>
 {!runId?<p>Выберите прогон для просмотра путей.</p>:!snapshotId?<p>Снимок схемы недоступен.</p>:<>
 {resource.loading&&<p role="status">Загружаем пути…</p>}{resource.error&&<div role="alert"><p>{analyticsError(resource.error)}</p><button type="button" onClick={resource.retry}>Повторить загрузку путей</button></div>}
 {page?.pathDataAvailability==='partial'&&<p>Исторические данные неполны: показаны только сохранённые пути.</p>}{page?.pathDataAvailability==='unavailable'&&<p>Данные путей недоступны. Отсутствие записей не доказывает, что к полю не обращались.</p>}
 {rows.map((row,index)=>{const key=JSON.stringify(row.path);return <ObjectFieldPath key={key} row={row} index={index} open={expanded===key} onToggle={()=>{const next=expanded===key?null:key;setExpanded(next);onHighlightPath?.(next?row.path:null)}} canSearch={canSearch} onFind={onFind}/>})}
 {!canSearch&&<p>Для поиска обращений нужны права доступа к журналу.</p>}
 {page?.pathDataAvailability==='available'&&!rows.length&&<p>В доступных данных этого прогона нет сохранённых путей к полю.</p>}
 {page&&offset+page.paths.items.length<page.paths.total&&page.paths.items.length>0&&<button type="button" disabled={resource.loading} onClick={()=>{setPrevious(rows);setOffset(offset+50)}}>Показать ещё</button>}
 </>}</section>;
 return <details className="field-request-paths" open={open} onToggle={e=>setOpen(e.currentTarget.open)}><summary>Пути обращения к полю</summary>{open&&(!runId?<p>Выберите прогон для просмотра путей.</p>:<>
  <p>pathHits — число обращений с сохранённой цепочкой выбранных полей. Это отдельная метрика, не coverage hits и не число вызовов resolver.</p>
  {resource.loading&&<p role="status">Загружаем пути…</p>}{resource.error&&<div role="alert"><p>{analyticsError(resource.error)}</p><button type="button" onClick={resource.retry}>Повторить загрузку путей</button></div>}
  {page?.pathDataAvailability==='partial'&&<p>Исторические данные неполны: показаны только сохранённые пути.</p>}{page?.pathDataAvailability==='unavailable'&&<p>Данные путей недоступны. Отсутствие записей не доказывает, что к полю не обращались.</p>}
  {rows.map((row,i)=><FieldPathItem key={JSON.stringify(row.path)} row={row} index={i} canSearch={canSearch} onFind={onFind}/>)}
  {!canSearch&&<p>Для поиска обращений нужны права доступа к журналу.</p>}
  {page?.pathDataAvailability==='available'&&!rows.length&&<p>В доступных данных этого прогона нет сохранённых путей к полю.</p>}
  {page&&offset+page.paths.items.length<page.paths.total&&page.paths.items.length>0&&<button type="button" disabled={resource.loading} onClick={()=>{setPrevious(rows);setOffset(offset+50)}}>Показать ещё</button>}
 </>)}</details>;
}


const requestPlural=new Intl.PluralRules('ru');
function requestCountLabel(count:number){
 const form=requestPlural.select(count);
 return `${count} ${form==='one'?'обращение':form==='few'?'обращения':'обращений'}`;
}
function ObjectFieldPath({row,index,open,onToggle,canSearch,onFind}:{row:QueryPath;index:number;open:boolean;onToggle:()=>void;canSearch:boolean;onFind:(path:SchemaCoordinate[])=>void}){
 const id=useId();
 return <article className="object-path">
  <button type="button" className="object-path-trigger" aria-expanded={open} aria-controls={id} onClick={onToggle}>
   <span><strong>Путь {index+1}</strong><small>{requestCountLabel(row.pathHits)} · Глубина {row.path.length}</small></span>
   <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d={open?'m5 12 5-5 5 5':'m5 8 5 5 5-5'}/></svg>
  </button>
  <div id={id} hidden={!open} className="object-path-body">
   <ol>{row.path.map((step,n)=><li key={n}>
    <span className="object-path-icon"><svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">{n===row.path.length-1?<><rect x="5" y="5" width="10" height="10" rx="2"/><circle cx="10" cy="10" r="1"/></>:<><path d="M6 3v9a3 3 0 0 0 3 3h5M6 7h8M11 4l3 3-3 3"/><circle cx="6" cy="3" r="1"/></>}</svg></span>
    <code>{step.typeName}.{step.fieldName}</code>
    {n<row.path.length-1&&<svg className="object-path-down" aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor"><path d="M10 3v13m-4-4 4 4 4-4"/></svg>}
   </li>)}</ol>
   <button type="button" className="object-path-search" disabled={!canSearch} onClick={()=>onFind(row.path)}>Найти обращения с этим путём</button>
  </div>
 </article>;
}
