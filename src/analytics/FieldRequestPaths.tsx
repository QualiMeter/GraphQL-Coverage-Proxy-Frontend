import {useState} from 'react';
import {getRunPaths,pathLabel,type QueryPath,type SchemaCoordinate} from '../api/runPaths';
import {useComparisonResource} from './useComparisonResource';
import {analyticsError} from './runAnalyticsModel';
import './requestPaths.css';
export function FieldPathItem({row,index,canSearch,onFind}:{row:QueryPath;index:number;canSearch:boolean;onFind:(path:SchemaCoordinate[])=>void}){
 return <details className="field-request-path"><summary>Путь {index+1} — {row.pathHits} обращений · Глубина {row.path.length}</summary><code>{pathLabel(row.path)}</code><ol>{row.path.map((c,n)=><li key={n}>{c.typeName}.{c.fieldName}</li>)}</ol><button type="button" onClick={()=>onFind(row.path)} disabled={!canSearch}>Найти обращения с этим путём</button></details>;
}
export function FieldRequestPaths({runId,snapshotId,field,scope,canSearch,onFind}:{runId?:string|null;snapshotId?:string|null;field:SchemaCoordinate;scope:string;canSearch:boolean;onFind:(path:SchemaCoordinate[])=>void}){
 const [open,setOpen]=useState(false),[offset,setOffset]=useState(0),[previous,setPrevious]=useState<QueryPath[]>([]);
 const resource=useComparisonResource(open&&runId&&snapshotId?JSON.stringify([scope,runId,snapshotId,field,offset]):null,signal=>getRunPaths(runId!,snapshotId!,field,offset,signal));
 const page=resource.data,rows=[...new Map([...previous,...(page?.paths.items??[])].map(p=>[JSON.stringify(p.path),p])).values()];
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
