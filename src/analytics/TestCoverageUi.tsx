import type {TestPage} from '../api/testCoverage';
import {analyticsError} from './runAnalyticsModel';
import './testCoverage.css';
export function TestResourceStatus({resource}:{resource:{loading:boolean;error?:Error;retry:()=>void}}){return resource.loading?<div className="test-message" role="status">Загрузка…</div>:resource.error?<div className="test-message" role="alert"><p>{analyticsError(resource.error)}</p><button type="button" className="run-control" onClick={resource.retry}>Повторить</button></div>:null}
export function TestPagination({page,offset,size,onPage}:{page:TestPage<unknown>;offset:number;size:number;onPage:(offset:number)=>void}){
 return <div className="test-pagination"><button type="button" className="run-control" disabled={!offset} onClick={()=>onPage(Math.max(0,offset-size))}>Назад</button><span>{page.total===null?`Страница ${offset/size+1} · общее число недоступно`:page.total===0?'Нет записей':!page.rows.length?`Нет записей на странице · Всего ${page.total}`:`${offset+1}–${Math.min(offset+page.rows.length,page.total)} из ${page.total}`}</span><button type="button" className="run-control" disabled={!page.more} onClick={()=>onPage(offset+size)}>Далее</button></div>;
}
