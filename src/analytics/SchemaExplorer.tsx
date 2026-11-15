import {useEffect,useMemo,useRef,useState} from 'react';
import type {GraphType} from '../model';
import {explorerResults,type CoverageFilter,type ExplorerSort,type RootFilter} from './explorer';
import './explorer.css';

type Props={types:GraphType[];coverageAvailable?:boolean;emptyMessage?:string;selectedType:string|null;selectedField:string|null;coverageRequest?:number;onType:(name:string)=>void;onField:(type:string,field:string)=>void;onClear:()=>void;onOverview:()=>void};
const coverageOptions:{id:CoverageFilter;label:string}[]=[{id:'all',label:'Все'},{id:'zero',label:'0%'},{id:'partial',label:'1–99%'},{id:'complete',label:'100%'}];
const rootOptions:{id:RootFilter;label:string}[]=[{id:'all',label:'Все'},{id:'query',label:'Query'},{id:'mutation',label:'Mutation'}];

export function SchemaExplorer({types,coverageAvailable=true,emptyMessage,selectedType,selectedField,coverageRequest=0,onType,onField,onClear,onOverview}:Props){
 const [collapsed,setCollapsed]=useState(false);
 const [filtersOpen,setFiltersOpen]=useState(false);
 const [search,setSearch]=useState('');
 const [coverage,setCoverage]=useState<CoverageFilter>('all');
 const [sort,setSort]=useState<ExplorerSort>('name');
 const [root,setRoot]=useState<RootFilter>('all');
 const lastCoverageRequest=useRef(coverageRequest);
 useEffect(()=>{if(coverageRequest!==lastCoverageRequest.current){lastCoverageRequest.current=coverageRequest;setCoverage('zero');setFiltersOpen(true);setSearch('');setRoot('all')}},[coverageRequest]);
 const results=useMemo(()=>explorerResults(types,search,coverage,sort,root),[types,search,coverage,sort,root]);
 const roots=results.filter(item=>Boolean(item.type.role));
 const objects=results.filter(item=>!item.type.role);
 const hasFilters=Boolean(search)||coverage!=='all'||sort!=='name'||root!=='all';
 const reset=()=>{setSearch('');setCoverage('all');setSort('name');setRoot('all')};
 const renderGroup=(title:string,items:typeof results)=><section className="explorer-group" aria-label={title}><h3>{title}<span>{items.length}</span></h3>{items.map(({type,fields})=><div className="explorer-item" key={type.name}><button type="button" className={`explorer-type ${selectedType===type.name?'selected':''}`} aria-pressed={selectedType===type.name} onClick={()=>onType(type.name)}><span className="explorer-type-main"><strong>{type.name}</strong><small>{type.coveredFields===null?`Полей: ${type.totalFields}`:`Не покрыто: ${type.totalFields-type.coveredFields}`}</small></span>{type.coveragePercent!==null&&<span className="explorer-coverage" title={`${type.coveredFields} из ${type.totalFields} полей`}><b>{type.coveragePercent.toFixed(0)}%</b><i><i style={{width:`${type.coveragePercent}%`}}/></i></span>}</button>{fields.length>0&&<div className="explorer-fields">{fields.map(field=><button type="button" key={field.name} className={`explorer-field ${selectedField===`${type.name}.${field.name}`?'selected':''}`} aria-pressed={selectedField===`${type.name}.${field.name}`} onClick={()=>onField(type.name,field.name)}><span><strong>{field.name}</strong><small>{type.name} · {field.returnType}</small></span>{field.covered!==null&&<span className={`explorer-field-dot ${field.covered?'covered':''}`} aria-label={field.covered?'Покрыто':'Не покрыто'}/>}</button>)}</div>}</div>)}</section>;
 return <aside className={collapsed?'schema-explorer collapsed':'schema-explorer'} aria-label="Schema Explorer">
  <div className="explorer-head">
   <div><strong>Типы схемы</strong><small>Найдено типов: {results.length}</small></div>
   <button type="button" aria-label={collapsed?'Развернуть Schema Explorer':'Свернуть Schema Explorer'} title={collapsed?'Развернуть':'Свернуть'} onClick={()=>setCollapsed(value=>!value)}>{collapsed?'›':'‹'}</button>
  </div>
  {!collapsed&&<>
   <div className="explorer-scroll">
    <label className="explorer-search"><span>Поиск типа или поля</span><input value={search} onChange={event=>setSearch(event.target.value)} placeholder="Например, customer"/></label>
    <div className="explorer-control-label">Точки входа схемы</div>
    <div className="explorer-roots" role="group" aria-label="Точки входа схемы">{(types.some(type=>type.role==='subscription'||type.rootOperations?.includes('subscription'))?[...rootOptions,{id:'subscription' as const,label:'Subscription'}]:rootOptions).map(option=><button type="button" key={option.id} className={root===option.id?'active':''} aria-pressed={root===option.id} onClick={()=>setRoot(option.id)}>{option.label}</button>)}</div>
    <div className="explorer-filter-line"><button type="button" aria-expanded={filtersOpen} onClick={()=>setFiltersOpen(value=>!value)}>{filtersOpen?'Скрыть фильтры':coverageAvailable?'Покрытие и сортировка':'Сортировка'}{(coverage!=='all'||sort!=='name')&&<b aria-label="Есть активные фильтры">●</b>}</button><button type="button" onClick={reset} disabled={!hasFilters}>Сбросить</button></div>
    {filtersOpen&&<div className="explorer-advanced">{coverageAvailable&&<><div className="explorer-control-label">Покрытие</div><div className="explorer-chips" role="group" aria-label="Фильтр покрытия">{coverageOptions.map(option=><button type="button" key={option.id} className={coverage===option.id?'active':''} aria-pressed={coverage===option.id} onClick={()=>setCoverage(option.id)}>{option.label}</button>)}</div></>}<label className="explorer-sort"><span>Сортировка</span><select value={sort} onChange={event=>setSort(event.target.value as ExplorerSort)}><option value="name">По имени</option>{coverageAvailable&&<><option value="coverage">По покрытию</option><option value="uncovered">По непокрытым полям</option></>}</select></label></div>}
    {roots.length>0&&renderGroup('Корневые типы',roots)}
    {objects.length>0&&renderGroup(objects.every(({type})=>type.kind==='OBJECT')?'Объектные типы':'Другие типы',objects)}
    {results.length===0&&<p className="explorer-empty">{types.length?'Совпадений нет. Измените поиск или фильтры.':emptyMessage??'Снимков схемы пока нет. Добавьте снимок в верхней панели.'}</p>}
   </div>
   {(selectedType||selectedField)&&<div className="explorer-actions"><button type="button" onClick={onClear}>Сбросить выделение</button><button type="button" className="overview" onClick={onOverview}>Общий обзор</button></div>}
  </>}
 </aside>;
}
