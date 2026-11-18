import {comparisonError} from './comparisonModel';
export function ComparisonStatus({resource}:{resource:{loading:boolean;error?:Error;retry:()=>void}}){
 return resource.loading?<p role="status">Загрузка…</p>:resource.error?<div className="comparison-error" role="alert"><p>{comparisonError(resource.error)}</p><button type="button" onClick={resource.retry}>Повторить</button></div>:null;
}
export function ComparisonPagination({offset,total,onPage,disabled=false}:{offset:number;total:number;onPage:(offset:number)=>void;disabled?:boolean}){
 return <div className="comparison-pagination"><button type="button" disabled={disabled||offset===0} onClick={()=>onPage(Math.max(0,offset-50))}>Назад</button><span>{total?`${offset+1}–${Math.min(offset+50,total)} из ${total}`:'Нет записей'}</span><button type="button" disabled={disabled||offset+50>=total} onClick={()=>onPage(offset+50)}>Далее</button></div>;
}
