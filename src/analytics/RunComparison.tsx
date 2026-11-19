import {Select} from '../components/Select';
import {useState} from 'react';
import {compareRuns,type RunComparisonRequest,type RunComparisonResponse,type ComparedFieldOut,type RunMetricOut} from '../api/runComparison';
import type {RunOut,RunQuery} from '../api/runs';
import {readHistoryPage} from '../api/gitlabHistory';
import {RunCiInfo} from './RunCiInfo';
import {RunHistoryFilters,type CiListContext} from './RunHistoryFilters';
import './gitlabHistory.css';
import type {Session} from '../api/auth';
import type {SnapshotOption} from './backendSchema';
import {chronological,selectionError} from './comparisonModel';
import {useComparisonResource} from './useComparisonResource';
import {ComparisonInvestigation} from './ComparisonInvestigation';
import {analyticsError} from './runAnalyticsModel';
import {ComparisonStatus,ComparisonPagination} from './ComparisonUi';
import './comparison.css';
import {useComparisonExport} from './ExportWorkspace';

export const fieldFilters={all:'Все поля',changed:'Изменили покрытие',newlyCovered:'Получили покрытие',noLongerCovered:'Потеряли покрытие',stillCovered:'Сохранили покрытие',stillUncovered:'Остались без покрытия',alwaysCovered:'Всегда покрыты',neverCovered:'Никогда не покрыты',intermittentlyCovered:'Нестабильное покрытие'};
type Filter=keyof typeof fieldFilters;
type Tab='Обзор'|'Поля'|'Типы'|'Исследование';
const date=(s:string)=>new Date(s).toLocaleString('ru-RU',{dateStyle:'short',timeStyle:'short'});
export const formatComparisonNumber=(v:number|null|undefined)=>v==null||!Number.isFinite(v)?'—':new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(Math.abs(v)<0.005?0:v);
const percent=(v:number)=>`${formatComparisonNumber(v)}%`;
export const signed=(v:number|null|undefined)=>v==null||!Number.isFinite(v)?'—':`${v>=0.005?'+':v<=-0.005?'−':''}${formatComparisonNumber(Math.abs(v))}`;
export function RunComparison({snapshots,initialSnapshotId,session,onBack,initialFilters}:{initialFilters?:CiListContext;snapshots:SnapshotOption[];initialSnapshotId:string|null;session:Session|null;onBack:()=>void}){
 const [snapshotId,setSnapshotId]=useState(initialSnapshotId??snapshots[0]?.id??'');
 const selected=snapshots.find(s=>s.id===snapshotId)??snapshots[0];
 return <section className="run-comparison" aria-label="Сравнение прогонов"><header className="comparison-heading"><div><button type="button" onClick={onBack}>← История прогонов</button><h1>Сравнение прогонов</h1></div><Select label="Снимок схемы" value={selected?.id??''} onChange={setSnapshotId} options={snapshots.map(s=>({value:s.id,label:s.name}))}/></header>{selected?<SnapshotComparison key={selected.id} snapshotId={selected.id} session={session} initialFilters={initialFilters}/>:<p>Нет доступных снимков схемы.</p>}</section>;
}
function SnapshotComparison({snapshotId,session,initialFilters}:{snapshotId:string;session:Session|null;initialFilters?:CiListContext}){
 const [search,setSearch]=useState('');
 const [offset,setOffset]=useState(0),[loaded,setLoaded]=useState<RunOut[]>([]),[chosen,setChosen]=useState<RunOut[]|null>(null);
 const [candidateQuery,setCandidateQuery]=useState<RunQuery>(session?{branch:initialFilters?.branch,environment:initialFilters?.environment}:{});
 const runs=useComparisonResource(JSON.stringify([snapshotId,offset,candidateQuery]),signal=>readHistoryPage({snapshotId},offset,signal,{...candidateQuery,status:'completed'}));
 const available=[...new Map([...loaded,...(runs.data?.page.runs??[])].filter(r=>r.status==='completed'&&r.snapshotId===snapshotId).map(r=>[r.id,r])).values()];
 const selection=chosen??chronological(available.slice(0,2));
 const [baseline,setBaseline]=useState(''),[target,setTarget]=useState('');
 const base=selection.some(r=>r.id===baseline)?baseline:selection[0]?.id??'';
 const end=selection.some(r=>r.id===target)?target:selection.at(-1)?.id??'';
 const [request,setRequest]=useState<RunComparisonRequest|null>(null),[tab,setTab]=useState<Tab>('Обзор'),[filter,setFilter]=useState<Filter>('all'),[typeFocus,setTypeFocus]=useState('');
 const [field,setField]=useState<ComparedFieldOut|null>(null),[pair,setPair]=useState<[string,string]>(['','']);
 const result=useComparisonResource(request?JSON.stringify(request):null,async signal=>{
  const data=await compareRuns(request!,session?.csrfToken,signal);
  if(data.snapshotId!==snapshotId)throw new Error('Сравнение относится к другому снимку.');
  return data;
 });
 const error=selectionError(selection,snapshotId,base,end);
 function invalidate(){setRequest(null);setField(null);setTypeFocus('')}
 function submit(fieldsOffset=0,typesOffset=0,nextFilter=filter){
  if(error)return;
  setField(null);
  const next={runIds:selection.map(r=>r.id),baselineRunId:base,targetRunId:end,fields:{filter:nextFilter,limit:50,offset:fieldsOffset},types:{limit:50,offset:typesOffset}};
  if(JSON.stringify(next)===JSON.stringify(request))result.retry();
  else setRequest(next);
 }
 function investigate(f:ComparedFieldOut,a=base,b=end){setField(f);setPair([a,b]);setTab('Исследование')}
 const data=result.data;
 const exportReady=Boolean(data&&request&&!error&&request.baselineRunId===base&&request.targetRunId===end&&request.runIds.length===selection.length&&selection.every(run=>request.runIds.includes(run.id)));
 useComparisonExport(exportReady?{request:request!,snapshotId,names:data!.runs.map(run=>run.name)}:null);
 return <>
  <nav className="comparison-tabs" aria-label="Разделы сравнения">{(['Обзор','Поля','Типы','Исследование'] as Tab[]).map(t=><button key={t} type="button" aria-current={tab===t?'page':undefined} onClick={()=>setTab(t)}>{t}</button>)}</nav>
  <section className="comparison-card comparison-selection"><h2>Сравниваемые прогоны</h2><div className="comparison-selected-pair">{[[base,'Baseline — исходный прогон'],[end,'Target — сравниваемый прогон']].map(([id,label])=>{const run=selection.find(r=>r.id===id);return <article key={label}><small>{label}</small><strong>{run?.name??'Выберите прогон'}</strong>{run&&<><small>{date(run.startedAt)}</small><span className="run-badge" data-status={run.status}>Сбор завершён</span><RunCiInfo ci={run.ci}/></>}</article>})}</div><details><summary>Изменить выбор · {selection.length} из 20</summary><p>Только завершённые прогоны одного снимка. Backend дополнительно проверит полноту GitLab-сбора.</p>
   <RunHistoryFilters compact query={candidateQuery} signedIn={Boolean(session)} onApply={next=>{setChosen(selection);setLoaded([]);setOffset(0);setCandidateQuery(next)}}/>
   <ComparisonStatus resource={runs}/>{runs.data?.ciError&&<p className="ci-history-notice" role="alert">CI-фильтры не применены. {analyticsError(runs.data.ciError)} Показаны завершённые прогоны снимка без CI-фильтров. Выбранные прогоны сохранены.</p>}
   <input className="comparison-search" aria-label="Поиск прогонов по названию" placeholder="Поиск по названию среди загруженных прогонов" value={search} onChange={e=>setSearch(e.target.value)}/><div className="comparison-run-picker">{available.filter(run=>run.name.toLocaleLowerCase().includes(search.toLocaleLowerCase())).map(run=><label key={run.id}><input type="checkbox" checked={selection.some(r=>r.id===run.id)} disabled={selection.length>=20&&!selection.some(r=>r.id===run.id)} onChange={e=>{setChosen(chronological(e.target.checked?[...selection,run]:selection.filter(r=>r.id!==run.id)));invalidate()}}/><span>{run.name}<small>{date(run.startedAt)} · Завершён</small><RunCiInfo ci={run.ci}/></span></label>)}</div>
   {runs.data?.page.hasMore&&<button type="button" onClick={()=>{setLoaded(available);setOffset(offset+50)}}>Загрузить ещё прогоны</button>}
   {runs.data&&!available.length&&<p>Нет завершённых прогонов по выбранным фильтрам этого снимка.</p>}
</details><div className="comparison-controls"><Select label="Baseline" value={base} options={selection.map(r=>({value:r.id,label:r.name}))} onChange={value=>{setBaseline(value);invalidate()}}/><Select label="Target" value={end} options={selection.map(r=>({value:r.id,label:r.name}))} onChange={value=>{setTarget(value);invalidate()}}/><button type="button" disabled={!base||!end||base===end} onClick={()=>{setBaseline(end);setTarget(base);invalidate()}}>Поменять местами</button><button type="button" className="run-control run-control-primary" disabled={Boolean(error)||result.loading} onClick={()=>submit()}>Сравнить</button></div><details><summary>Серия прогонов · {selection.length}</summary>
   <ol className="comparison-sequence">{chronological(selection).map(r=><li key={r.id}>{r.name}<RunCiInfo ci={r.ci}/> <button aria-label={`Убрать ${r.name}`} type="button" onClick={()=>{setChosen(selection.filter(s=>s.id!==r.id));invalidate()}}>×</button></li>)}</ol>
   {error&&<p role="status">{error}</p>}
  </details></section>

  <ComparisonStatus resource={result}/>
  {!request&&<p className="comparison-card">Выберите прогоны и нажмите «Сравнить».</p>}
  {data&&<><details className="comparison-backend-order"><summary>Порядок серии</summary><ol className="comparison-sequence" aria-label="Порядок прогонов backend">{data.runs.map((r,i)=><li key={r.runId}>{i+1}. {r.name}<RunCiInfo ci={selection.find(run=>run.id===r.runId)?.ci}/></li>)}</ol></details>
   {tab==='Обзор'&&<Overview data={data}/>}
   {tab==='Поля'&&<section className="comparison-card"><div className="comparison-controls"><h2>Поля</h2><Select label="Категория" value={filter} options={Object.entries(fieldFilters).map(([value,label])=>({value,label:`${label}${data.fieldCategories[value]!==undefined?` (${data.fieldCategories[value]})`:''}`}))} onChange={value=>{const next=value as Filter;setFilter(next);submit(0,request?.types?.offset??0,next)}}/>{typeFocus&&<button type="button" onClick={()=>setTypeFocus('')}>Тип {typeFocus} ×</button>}</div>
    {typeFocus&&<p>Поля типа {typeFocus} на текущей странице. API сравнения не поддерживает фильтр типа; используйте пагинацию общего списка.</p>}
    <div className="table-scroll"><table><thead><tr><th>Тип / поле</th><th>Hits baseline → target</th><th>Изменение</th><th>Частота</th><th>Переходы</th><th>Устойчивость</th></tr></thead><tbody>{data.fields.items.filter(f=>!typeFocus||f.typeName===typeFocus).map(f=><tr key={`${f.typeName}.${f.fieldName}`} className={f.baselineToTarget==='noLongerCovered'?'comparison-loss':undefined}><td><button type="button" onClick={()=>investigate(f)}>{f.typeName}.{f.fieldName}</button><details><summary>История покрытия</summary><FieldTimeline field={f} runs={data.runs} onPair={(a,b)=>investigate(f,a,b)}/></details></td><td>{f.hitsByRun.find(h=>h.runId===data.baselineRunId)?.hits} → {f.hitsByRun.find(h=>h.runId===data.targetRunId)?.hits}</td><td>{fieldFilters[f.baselineToTarget]}</td><td>{f.coveredRunCount}/{data.runs.length} · {percent(f.coverageFrequencyPercent)}</td><td>{f.coverageTransitions}</td><td>{fieldFilters[f.stability]}</td></tr>)}</tbody></table></div>
    {!data.fields.items.length&&<p>Нет полей в выбранной категории. Выберите «Все поля», чтобы исследовать схему.</p>}
    <ComparisonPagination offset={request?.fields?.offset??0} total={data.fields.total} onPage={n=>submit(n,request?.types?.offset??0)}/>
   </section>}
   {tab==='Типы'&&<section className="comparison-card"><h2>Типы GraphQL</h2><div className="table-scroll"><table><thead><tr><th>Тип</th><th>Полей</th><th>Baseline → target</th><th>Изменение, п.п.</th><th>Динамика</th></tr></thead><tbody>{data.types.items.map(t=>{const a=t.runs.find(r=>r.runId===data.baselineRunId)!,b=t.runs.find(r=>r.runId===data.targetRunId)!;return <tr key={t.typeName}><td><button type="button" onClick={()=>{setTypeFocus(t.typeName);setFilter('all');submit(0,request?.types?.offset??0,'all');setTab('Поля')}}>{t.typeName}</button><small>{t.rootRole??'OBJECT'}</small></td><td>{t.totalFields}</td><td>{a.coveredFields} ({percent(a.coveragePercent)}) → {b.coveredFields} ({percent(b.coveragePercent)})</td><td className={b.coveragePercent===a.coveragePercent?'':b.coveragePercent>a.coveragePercent?'comparison-present':'comparison-absent'}>{signed(b.coveragePercent-a.coveragePercent)}</td><td><details><summary>Все прогоны</summary>{data.runs.map((r,i)=>{const v=t.runs.find(v=>v.runId===r.runId)!;return <div key={r.runId}>{i+1}. {r.name}: {v.coveredFields}/{t.totalFields} · {percent(v.coveragePercent)}</div>})}</details></td></tr>})}</tbody></table></div><ComparisonPagination offset={request?.types?.offset??0} total={data.types.total} onPage={n=>submit(request?.fields?.offset??0,n)}/></section>}
   {tab==='Исследование'&&<FieldSearch data={data} csrfToken={session?.csrfToken} onSelect={investigate}/>}
   {tab==='Исследование'&&(field?<><div className="comparison-card"><h2>{field.typeName}.{field.fieldName}</h2><div className="comparison-controls">{pair.map((id,i)=><Select key={i} label={`Прогон ${i===0?'A':'B'}`} value={id} options={data.runs.filter(r=>r.runId!==pair[1-i]).map(r=>({value:r.runId,label:r.name}))} onChange={value=>setPair(old=>i===0?[value,old[1]]:[old[0],value])}/>)}</div><FieldTimeline field={field} runs={data.runs} onPair={(a,b)=>setPair([a,b])}/></div><ComparisonInvestigation key={JSON.stringify([pair,field.typeName,field.fieldName])} field={field} runs={data.runs} pair={pair} role={session?.user.role}/></>:<p className="comparison-card">Выберите поле в разделе «Поля» и откройте его исследование.</p>)}
  </>}
 </>;
}
export function FieldTimeline({field,runs,onPair}:{field:ComparedFieldOut;runs:RunMetricOut[];onPair:(a:string,b:string)=>void}){
 return <ol className="comparison-timeline">{runs.map((r,i)=>{const hits=field.hitsByRun.find(h=>h.runId===r.runId)?.hits;const previous=i?field.hitsByRun.find(h=>h.runId===runs[i-1].runId)?.hits:undefined;return <li key={r.runId}><span className={hits===undefined?'':hits>0?'comparison-present':'comparison-absent'}>{i+1}. {r.name}: {hits===undefined?'Нет данных':`${hits>0?'Покрыто':'Не покрыто'} · ${hits} hits`}</span>{i>0&&<button type="button" onClick={()=>onPair(runs[i-1].runId,r.runId)}>{previous!==undefined&&hits!==undefined&&(previous>0)!==(hits>0)?hits>0?'↑ Получено покрытие':'↓ Потеряно покрытие':'Исследовать переход'}</button>}</li>})}</ol>;
}
function Overview({data}:{data:RunComparisonResponse}){
 const a=data.runs.find(r=>r.runId===data.baselineRunId)!,b=data.runs.find(r=>r.runId===data.targetRunId)!,d=data.comparison;
 const metrics:[string,number|null,number|null,number|null,'good'|'bad'|'neutral',string?][]=[['Покрытие',a.coveragePercent,b.coveragePercent,d.percentagePointDelta,'good','%'],['Покрытые поля',a.coveredFields,b.coveredFields,d.coveredFieldsDelta,'good'],['Обращения',a.totalRequests,b.totalRequests,d.requestsDelta,'neutral'],['Учтено в покрытии',a.countedRequests,b.countedRequests,d.countedRequestsDelta,'neutral'],['Уникальные операции',a.uniqueOperations,b.uniqueOperations,d.uniqueOperationsDelta,'neutral'],['HTTP-ошибки',a.httpErrorCount,b.httpErrorCount,d.httpErrorCountDelta,'bad'],['GraphQL-ошибки',a.graphqlErrorCount,b.graphqlErrorCount,d.graphqlErrorCountDelta,'bad'],['Среднее время',a.avgDurationMs,b.avgDurationMs,d.avgDurationDeltaMs,'bad','мс'],['P95',a.p95DurationMs,b.p95DurationMs,d.p95DurationDeltaMs,'bad','мс']];
 return <><div className="comparison-metrics">{[...metrics.slice(0,2),metrics[6],metrics[7],...metrics.slice(2,6),metrics[8]].map(([title,left,right,delta,polarity,unit],index)=><article className={`comparison-card ${index<4?'comparison-primary-metric':'comparison-secondary-metric'}`} key={title}><h3>{title}</h3><strong>{left===null?'—':`${formatComparisonNumber(left)}${unit??''}`} → {right===null?'—':`${formatComparisonNumber(right)}${unit??''}`}</strong><p className={delta===null||delta===0||polarity==='neutral'?'':(delta>0)===(polarity==='good')?'comparison-present':'comparison-absent'}>Δ {signed(delta)} {unit==='%'?'п.п.':unit??''}</p></article>)}</div>{data.runs.length>2&&<CoverageTrend runs={data.runs}/>}<section className="comparison-card"><h2>Соседние переходы покрытия</h2><ol>{d.adjacentCoverageDeltasPp.map((v,i)=><li key={i}><span title={`${data.runs[i].name} → ${data.runs[i+1].name}`}>Прогон {i+1} → {i+2}</span>: {signed(v.deltaPp as number)} п.п.</li>)}</ol><details><summary>Типы операций и статусы анализатора</summary><div className="comparison-run-details">{data.runs.map(r=><article key={r.runId}><h3>{r.name}</h3><p>Query {r.queryRequests} · Mutation {r.mutationRequests} · Subscription {r.subscriptionRequests}</p><dl>{Object.entries(r.analysisStatusCounts).map(([k,v])=><div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl></article>)}</div></details></section></>;
}
export function CoverageTrend({runs}:{runs:RunMetricOut[]}){
 const [metric,setMetric]=useState<'coveragePercent'|'totalRequests'|'httpErrorCount'|'graphqlErrorCount'|'avgDurationMs'|'p95DurationMs'>('coveragePercent');
 const labels={coveragePercent:'Покрытие, %',totalRequests:'Обращения',httpErrorCount:'HTTP-ошибки',graphqlErrorCount:'GraphQL-ошибки',avgDurationMs:'Среднее время, мс',p95DurationMs:'P95, мс'};
 const values=runs.map(r=>r[metric]),max=Math.max(1,...values.filter((v):v is number=>v!==null)),points=values.map((v,i)=>({x:30+i*540/Math.max(1,runs.length-1),y:v===null?null:150-v/max*120}));
 return <section className="comparison-card"><Select label="Динамика" value={metric} options={Object.entries(labels).map(([value,label])=>({value,label}))} onChange={value=>setMetric(value as typeof metric)}/><svg className="comparison-chart" viewBox="0 0 600 180" role="img" aria-label={labels[metric]}><path d="M30 20V150H580" fill="none" stroke="currentColor"/>{points.map((p,i)=><g key={runs[i].runId}>{i>0&&p.y!==null&&points[i-1].y!==null&&<line x1={points[i-1].x} y1={points[i-1].y!} x2={p.x} y2={p.y} stroke="var(--purple)" strokeWidth="2"/>}{p.y!==null&&<circle cx={p.x} cy={p.y} r="4" fill="var(--purple)"><title>{`${runs[i].name}: ${formatComparisonNumber(values[i])}`}</title></circle>}<text x={p.x} y="170" textAnchor="middle">{new Date(runs[i].startedAt).toLocaleDateString('ru-RU',{day:'2-digit',month:'2-digit'})}</text></g>)}</svg><ol className="comparison-sequence">{runs.map((r,i)=><li key={r.runId}>{i+1}. {r.name}: {metric.endsWith('Ms')?`${formatComparisonNumber(values[i])} мс`:values[i]===null?'—':`${formatComparisonNumber(values[i])}${metric==='coveragePercent'?'%':''}`}</li>)}</ol></section>;
}

function FieldSearch({data,onSelect,csrfToken}:{csrfToken?:string;data:RunComparisonResponse;onSelect:(field:ComparedFieldOut)=>void}){
 const [search,setSearch]=useState(''),[offset,setOffset]=useState(0);
 const request={runIds:data.runs.map(r=>r.runId),baselineRunId:data.baselineRunId,targetRunId:data.targetRunId,fields:{filter:'all' as const,limit:50,offset},types:{limit:1,offset:0}};
 const resource=useComparisonResource(JSON.stringify(request),signal=>compareRuns(request,csrfToken,signal));
 const rows=resource.data?.fields.items.filter(f=>`${f.typeName}.${f.fieldName}`.toLowerCase().includes(search.toLowerCase()))??[];
 return <section className="comparison-card"><h2>Выберите GraphQL-поле</h2><input className="comparison-search" aria-label="Поиск GraphQL-поля" placeholder="Координата или имя на текущей странице" value={search} onChange={e=>setSearch(e.target.value)}/><ComparisonStatus resource={resource}/><div className="comparison-field-options">{rows.map(f=><button type="button" key={`${f.typeName}.${f.fieldName}`} onClick={()=>onSelect(f)}>{f.typeName}.{f.fieldName}</button>)}</div>{resource.data&&<><p>Поиск среди полей текущей страницы. Для остальных полей используйте пагинацию.</p>{!rows.length&&<p>Поля не найдены.</p>}<ComparisonPagination offset={offset} total={resource.data.fields.total} onPage={setOffset}/></>}</section>;
}
