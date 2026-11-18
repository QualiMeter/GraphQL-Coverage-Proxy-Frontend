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
import {analyticsError,millis} from './runAnalyticsModel';
import {ComparisonStatus,ComparisonPagination} from './ComparisonUi';
import './comparison.css';
import {useComparisonExport} from './ExportWorkspace';

export const fieldFilters={all:'Все поля',changed:'Изменили покрытие',newlyCovered:'Получили покрытие',noLongerCovered:'Потеряли покрытие',stillCovered:'Сохранили покрытие',stillUncovered:'Остались без покрытия',alwaysCovered:'Всегда покрыты',neverCovered:'Никогда не покрыты',intermittentlyCovered:'Нестабильное покрытие'};
type Filter=keyof typeof fieldFilters;
type Tab='Обзор'|'Поля'|'Типы'|'Исследование';
const date=(s:string)=>new Date(s).toLocaleString('ru-RU',{dateStyle:'short',timeStyle:'short'});
const percent=(v:number)=>`${v.toLocaleString('ru-RU',{maximumFractionDigits:2})}%`;
export const signed=(n:number|null|undefined)=>n==null?'—':`${n>0?'+':''}${n.toLocaleString('ru-RU',{maximumFractionDigits:2})}`;
export function RunComparison({snapshots,initialSnapshotId,session,onBack,initialFilters}:{initialFilters?:CiListContext;snapshots:SnapshotOption[];initialSnapshotId:string|null;session:Session|null;onBack:()=>void}){
 const [snapshotId,setSnapshotId]=useState(initialSnapshotId??snapshots[0]?.id??'');
 const selected=snapshots.find(s=>s.id===snapshotId)??snapshots[0];
 return <section className="run-comparison" aria-label="Сравнение прогонов"><header className="comparison-heading"><div><button type="button" onClick={onBack}>← История прогонов</button><h1>Сравнение прогонов</h1></div><label>Снимок схемы<select value={selected?.id??''} onChange={e=>setSnapshotId(e.target.value)}>{snapshots.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label></header>{selected?<SnapshotComparison key={selected.id} snapshotId={selected.id} session={session} initialFilters={initialFilters}/>:<p>Нет доступных снимков схемы.</p>}</section>;
}
function SnapshotComparison({snapshotId,session,initialFilters}:{snapshotId:string;session:Session|null;initialFilters?:CiListContext}){
 const [offset,setOffset]=useState(0),[loaded,setLoaded]=useState<RunOut[]>([]),[chosen,setChosen]=useState<RunOut[]|null>(null);
 const [candidateQuery,setCandidateQuery]=useState<RunQuery>(session?{branch:initialFilters?.branch,environment:initialFilters?.environment}:{});
 const runs=useComparisonResource(JSON.stringify([snapshotId,offset,candidateQuery]),signal=>readHistoryPage({snapshotId},offset,signal,{...candidateQuery,status:'completed'}));
 const available=[...new Map([...loaded,...(runs.data?.page.runs??[])].filter(r=>r.status==='completed'&&r.snapshotId===snapshotId).map(r=>[r.id,r])).values()];
 const selection=chosen??chronological(available.slice(0,2));
 const [baseline,setBaseline]=useState(''),[target,setTarget]=useState('');
 const base=selection.some(r=>r.id===baseline)?baseline:selection[0]?.id??'';
 const end=selection.some(r=>r.id===target)?target:selection.at(-1)?.id??'';
 const [request,setRequest]=useState<RunComparisonRequest|null>(null),[tab,setTab]=useState<Tab>('Обзор'),[filter,setFilter]=useState<Filter>('noLongerCovered'),[typeFocus,setTypeFocus]=useState('');
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
  <details className="comparison-card" open><summary>Выбор прогонов · {selection.length} из 20</summary><p>Только завершённые прогоны одного снимка. Backend дополнительно проверит полноту GitLab-сбора.</p>
   <RunHistoryFilters compact query={candidateQuery} signedIn={Boolean(session)} onApply={next=>{setChosen(selection);setLoaded([]);setOffset(0);setCandidateQuery(next)}}/>
   <ComparisonStatus resource={runs}/>{runs.data?.ciError&&<p className="ci-history-notice" role="alert">CI-фильтры не применены. {analyticsError(runs.data.ciError)} Показаны завершённые прогоны снимка без CI-фильтров. Выбранные прогоны сохранены.</p>}
   <div className="comparison-run-picker">{available.map(run=><label key={run.id}><input type="checkbox" checked={selection.some(r=>r.id===run.id)} disabled={selection.length>=20&&!selection.some(r=>r.id===run.id)} onChange={e=>{setChosen(chronological(e.target.checked?[...selection,run]:selection.filter(r=>r.id!==run.id)));invalidate()}}/><span>{run.name}<small>{date(run.startedAt)} · Завершён</small><RunCiInfo ci={run.ci}/></span></label>)}</div>
   {runs.data?.page.hasMore&&<button type="button" onClick={()=>{setLoaded(available);setOffset(offset+50)}}>Загрузить ещё прогоны</button>}
   {runs.data&&!available.length&&<p>Нет завершённых прогонов по выбранным фильтрам этого снимка.</p>}
   <div className="comparison-controls"><label>Baseline<select value={base} onChange={e=>{setBaseline(e.target.value);invalidate()}}>{selection.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label><label>Target<select value={end} onChange={e=>{setTarget(e.target.value);invalidate()}}>{selection.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label><button type="button" className="run-control run-control-primary" disabled={Boolean(error)||result.loading} onClick={()=>submit()}>Сравнить</button></div>
   <ol className="comparison-sequence">{chronological(selection).map(r=><li key={r.id}>{r.name}<RunCiInfo ci={r.ci}/> <button aria-label={`Убрать ${r.name}`} type="button" onClick={()=>{setChosen(selection.filter(s=>s.id!==r.id));invalidate()}}>×</button></li>)}</ol>
   {error&&<p role="status">{error}</p>}
  </details>
  <nav className="comparison-tabs" aria-label="Разделы сравнения">{(['Обзор','Поля','Типы','Исследование'] as Tab[]).map(t=><button key={t} type="button" aria-current={tab===t?'page':undefined} onClick={()=>setTab(t)}>{t}</button>)}</nav>
  <ComparisonStatus resource={result}/>
  {!request&&<p className="comparison-card">Выберите прогоны и нажмите «Сравнить».</p>}
  {data&&<><ol className="comparison-sequence" aria-label="Порядок прогонов backend">{data.runs.map((r,i)=><li key={r.runId}>{i+1}. {r.name}<RunCiInfo ci={selection.find(run=>run.id===r.runId)?.ci}/></li>)}</ol>
   {tab==='Обзор'&&<><div className="comparison-ci-context comparison-card"><div><strong>Baseline: {selection.find(run=>run.id===data.baselineRunId)?.name}</strong><RunCiInfo ci={selection.find(run=>run.id===data.baselineRunId)?.ci}/></div><div><strong>Target: {selection.find(run=>run.id===data.targetRunId)?.name}</strong><RunCiInfo ci={selection.find(run=>run.id===data.targetRunId)?.ci}/></div></div><Overview data={data}/></>}
   {tab==='Поля'&&<section className="comparison-card"><div className="comparison-controls"><h2>Поля</h2><label>Категория<select value={filter} onChange={e=>{const next=e.target.value as Filter;setFilter(next);submit(0,request?.types?.offset??0,next)}}>{Object.entries(fieldFilters).map(([key,label])=><option key={key} value={key}>{label}{data.fieldCategories[key]!==undefined?` (${data.fieldCategories[key]})`:''}</option>)}</select></label>{typeFocus&&<button type="button" onClick={()=>setTypeFocus('')}>Тип {typeFocus} ×</button>}</div>
    {typeFocus&&<p>Поля типа {typeFocus} на текущей странице. API сравнения не поддерживает фильтр типа; используйте пагинацию общего списка.</p>}
    <div className="table-scroll"><table><thead><tr><th>Тип / поле</th><th>Hits baseline → target</th><th>Изменение</th><th>Частота</th><th>Переходы</th><th>Устойчивость</th></tr></thead><tbody>{data.fields.items.filter(f=>!typeFocus||f.typeName===typeFocus).map(f=><tr key={`${f.typeName}.${f.fieldName}`} className={f.baselineToTarget==='noLongerCovered'?'comparison-loss':undefined}><td><button type="button" onClick={()=>investigate(f)}>{f.typeName}.{f.fieldName}</button><details><summary>История покрытия</summary><FieldTimeline field={f} runs={data.runs} onPair={(a,b)=>investigate(f,a,b)}/></details></td><td>{f.hitsByRun.find(h=>h.runId===data.baselineRunId)?.hits} → {f.hitsByRun.find(h=>h.runId===data.targetRunId)?.hits}</td><td>{fieldFilters[f.baselineToTarget]}</td><td>{f.coveredRunCount}/{data.runs.length} · {percent(f.coverageFrequencyPercent)}</td><td>{f.coverageTransitions}</td><td>{fieldFilters[f.stability]}</td></tr>)}</tbody></table></div>
    {!data.fields.items.length&&<p>Нет полей в выбранной категории. Выберите «Все поля», чтобы исследовать схему.</p>}
    <ComparisonPagination offset={request?.fields?.offset??0} total={data.fields.total} onPage={n=>submit(n,request?.types?.offset??0)}/>
   </section>}
   {tab==='Типы'&&<section className="comparison-card"><h2>Типы GraphQL</h2><div className="table-scroll"><table><thead><tr><th>Тип</th><th>Полей</th><th>Baseline → target</th><th>Изменение, п.п.</th><th>Динамика</th></tr></thead><tbody>{data.types.items.map(t=>{const a=t.runs.find(r=>r.runId===data.baselineRunId)!,b=t.runs.find(r=>r.runId===data.targetRunId)!;return <tr key={t.typeName}><td><button type="button" onClick={()=>{setTypeFocus(t.typeName);setFilter('all');submit(0,request?.types?.offset??0,'all');setTab('Поля')}}>{t.typeName}</button><small>{t.rootRole??'OBJECT'}</small></td><td>{t.totalFields}</td><td>{a.coveredFields} ({percent(a.coveragePercent)}) → {b.coveredFields} ({percent(b.coveragePercent)})</td><td>{signed(b.coveragePercent-a.coveragePercent)}</td><td><details><summary>Все прогоны</summary>{data.runs.map((r,i)=>{const v=t.runs.find(v=>v.runId===r.runId)!;return <div key={r.runId}>{i+1}. {r.name}: {v.coveredFields}/{t.totalFields} · {percent(v.coveragePercent)}</div>})}</details></td></tr>})}</tbody></table></div><ComparisonPagination offset={request?.types?.offset??0} total={data.types.total} onPage={n=>submit(request?.fields?.offset??0,n)}/></section>}
   {tab==='Исследование'&&(field?<><div className="comparison-card"><h2>{field.typeName}.{field.fieldName}</h2><div className="comparison-controls">{pair.map((id,i)=><label key={i}>Прогон {i===0?'A':'B'}<select value={id} onChange={e=>setPair(old=>i===0?[e.target.value,old[1]]:[old[0],e.target.value])}>{data.runs.map(r=><option disabled={r.runId===pair[1-i]} key={r.runId} value={r.runId}>{r.name}</option>)}</select></label>)}</div><FieldTimeline field={field} runs={data.runs} onPair={(a,b)=>setPair([a,b])}/></div><ComparisonInvestigation key={JSON.stringify([pair,field.typeName,field.fieldName])} field={field} runs={data.runs} pair={pair} role={session?.user.role}/></>:<p className="comparison-card">Выберите поле в разделе «Поля» и откройте его исследование.</p>)}
  </>}
 </>;
}
export function FieldTimeline({field,runs,onPair}:{field:ComparedFieldOut;runs:RunMetricOut[];onPair:(a:string,b:string)=>void}){
 return <ol className="comparison-timeline">{runs.map((r,i)=>{const hits=field.hitsByRun.find(h=>h.runId===r.runId)?.hits;const previous=i?field.hitsByRun.find(h=>h.runId===runs[i-1].runId)?.hits:undefined;return <li key={r.runId}><span className={hits===undefined?'':hits>0?'comparison-present':'comparison-absent'}>{i+1}. {r.name}: {hits===undefined?'Нет данных':`${hits>0?'Покрыто':'Не покрыто'} · ${hits} hits`}</span>{i>0&&<button type="button" onClick={()=>onPair(runs[i-1].runId,r.runId)}>{previous!==undefined&&hits!==undefined&&(previous>0)!==(hits>0)?hits>0?'↑ Получено покрытие':'↓ Потеряно покрытие':'Исследовать переход'}</button>}</li>})}</ol>;
}
function Overview({data}:{data:RunComparisonResponse}){
 const a=data.runs.find(r=>r.runId===data.baselineRunId)!,b=data.runs.find(r=>r.runId===data.targetRunId)!,d=data.comparison;
 const metrics:[string,number|null,number|null,number|null,'good'|'bad'|'neutral',string?][]=[['Покрытие',a.coveragePercent,b.coveragePercent,d.percentagePointDelta,'good','%'],['Покрытые поля',a.coveredFields,b.coveredFields,d.coveredFieldsDelta,'good'],['Обращения',a.totalRequests,b.totalRequests,d.requestsDelta,'neutral'],['Учтено в покрытии',a.countedRequests,b.countedRequests,d.countedRequestsDelta,'neutral'],['Уникальные операции',a.uniqueOperations,b.uniqueOperations,d.uniqueOperationsDelta,'neutral'],['HTTP-ошибки',a.httpErrorCount,b.httpErrorCount,d.httpErrorCountDelta,'bad'],['GraphQL-ошибки',a.graphqlErrorCount,b.graphqlErrorCount,d.graphqlErrorCountDelta,'bad'],['Среднее время',a.avgDurationMs,b.avgDurationMs,d.avgDurationDeltaMs,'bad','мс'],['P95',a.p95DurationMs,b.p95DurationMs,d.p95DurationDeltaMs,'bad','мс']];
 return <><div className="comparison-metrics">{metrics.map(([title,left,right,delta,polarity,unit])=><article className="comparison-card" key={title}><h3>{title}</h3><strong>{left===null?'—':`${left}${unit??''}`} → {right===null?'—':`${right}${unit??''}`}</strong><p className={delta===null||delta===0||polarity==='neutral'?'':(delta>0)===(polarity==='good')?'comparison-present':'comparison-absent'}>Δ {signed(delta)} {unit==='%'?'п.п.':unit??''}</p></article>)}</div><CoverageTrend runs={data.runs}/><section className="comparison-card"><h2>Соседние переходы покрытия</h2><ol>{d.adjacentCoverageDeltasPp.map((v,i)=><li key={i}>{data.runs[i].name} → {data.runs[i+1].name}: {signed(v.deltaPp as number)} п.п.</li>)}</ol><details><summary>Типы операций и статусы анализатора</summary><div className="comparison-run-details">{data.runs.map(r=><article key={r.runId}><h3>{r.name}</h3><p>Query {r.queryRequests} · Mutation {r.mutationRequests} · Subscription {r.subscriptionRequests}</p><dl>{Object.entries(r.analysisStatusCounts).map(([k,v])=><div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl></article>)}</div></details></section></>;
}
export function CoverageTrend({runs}:{runs:RunMetricOut[]}){
 const [metric,setMetric]=useState<'coveragePercent'|'totalRequests'|'httpErrorCount'|'graphqlErrorCount'|'avgDurationMs'|'p95DurationMs'>('coveragePercent');
 const labels={coveragePercent:'Покрытие, %',totalRequests:'Обращения',httpErrorCount:'HTTP-ошибки',graphqlErrorCount:'GraphQL-ошибки',avgDurationMs:'Среднее время, мс',p95DurationMs:'P95, мс'};
 const values=runs.map(r=>r[metric]),max=Math.max(1,...values.filter((v):v is number=>v!==null)),points=values.map((v,i)=>({x:30+i*540/Math.max(1,runs.length-1),y:v===null?null:150-v/max*120}));
 return <section className="comparison-card"><label>Динамика<select value={metric} onChange={e=>setMetric(e.target.value as typeof metric)}>{Object.entries(labels).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label><svg className="comparison-chart" viewBox="0 0 600 180" role="img" aria-label={labels[metric]}><path d="M30 20V150H580" fill="none" stroke="currentColor"/>{points.map((p,i)=><g key={runs[i].runId}>{i>0&&p.y!==null&&points[i-1].y!==null&&<line x1={points[i-1].x} y1={points[i-1].y!} x2={p.x} y2={p.y} stroke="var(--purple)" strokeWidth="2"/>}{p.y!==null&&<circle cx={p.x} cy={p.y} r="4" fill="var(--purple)"><title>{`${runs[i].name}: ${values[i]}`}</title></circle>}<text x={p.x} y="170" textAnchor="middle">{i+1}</text></g>)}</svg><ol className="comparison-sequence">{runs.map((r,i)=><li key={r.runId}>{i+1}. {r.name}: {metric.endsWith('Ms')?millis(values[i]):values[i]===null?'—':`${values[i]}${metric==='coveragePercent'?'%':''}`}</li>)}</ol></section>;
}
