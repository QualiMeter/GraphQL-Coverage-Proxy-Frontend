import {useEffect,useRef,useState} from 'react';
import {datasetLabels,prepareExport,comparisonExportBody,type Dataset,type ExportFilters} from '../api/exports';
import {exportError,saveExport,type ExportFormat} from '../api/download';
import {useExportWorkspace} from './ExportWorkspace';
import {mayReadJournal} from './runAnalyticsModel';
import './export.css';
type Props={runId?:string;snapshotId?:string;serviceId:string;role?:string;csrfToken?:string;comparisonMode:boolean;testFilters?:ExportFilters['tests']};
export function ExportCenter(props:Props){
 const [open,setOpen]=useState(false),store=useExportWorkspace();
 const enabled=props.comparisonMode?Boolean(store?.comparison):Boolean(props.runId);
 // Keep the launcher in one place; a context change also unmounts any active job.
 const key=JSON.stringify([props.runId,props.snapshotId,props.serviceId,props.role,props.comparisonMode,store?.comparison]);
 return <div className="export-center"><button type="button" className="run-control export-launcher" disabled={!enabled} aria-haspopup="dialog" aria-expanded={open} onClick={()=>setOpen(true)} title={!enabled?(props.comparisonMode?'Сначала рассчитайте актуальное сравнение.':'Выберите прогон.'):undefined}><svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M8 2v8m-3-3 3 3 3-3M3 11v3h10v-3"/></svg>Экспорт</button>{open&&<ExportDialog key={key} {...props} enabled={enabled} onClose={()=>setOpen(false)}/>}</div>;
}
function ExportDialog({onClose,enabled,...props}:Props&{enabled:boolean;onClose:()=>void}){
 const store=useExportWorkspace(),dialog=useRef<HTMLDialogElement>(null),controller=useRef<AbortController|null>(null),locked=useRef(false);
 const [format,setFormat]=useState<ExportFormat>('csv'),[selected,setSelected]=useState<Dataset[]>(['coverage']),[filtered,setFiltered]=useState(true),[busy,setBusy]=useState(false),[progress,setProgress]=useState(''),[error,setError]=useState('');
 const allowed=(Object.keys(datasetLabels) as Dataset[]).filter(dataset=>dataset==='coverage'||dataset==='operations'||mayReadJournal(props.role));
 const chosen=selected.filter(dataset=>allowed.includes(dataset));
 const comparison=store?.comparison;
 const blocked=filtered&&!props.comparisonMode&&chosen.some(dataset=>store?.blocked[dataset]);
 const fingerprint=JSON.stringify([filtered?[store?.filters,store?.blocked]:null,filtered?props.testFilters:null]);
 const currentFingerprint=useRef(fingerprint);currentFingerprint.current=fingerprint;
 useEffect(()=>{dialog.current?.showModal();return ()=>{controller.current?.abort()}},[]);
 useEffect(()=>{controller.current?.abort();locked.current=false;setBusy(false);setProgress('')},[fingerprint]);
 function close(){controller.current?.abort();dialog.current?.close();onClose()}
 async function submit(){
  if(blocked||locked.current||!enabled||!props.snapshotId||!props.runId&&!comparison||!props.comparisonMode&&!chosen.length)return;
  locked.current=true;setBusy(true);setError('');setProgress('Подготовка экспорта…');const abort=new AbortController();controller.current=abort;
  const identity=currentFingerprint.current;
  try{
   const job={runId:props.runId??comparison!.request.baselineRunId,snapshotId:props.comparisonMode?comparison!.snapshotId:props.snapshotId,serviceId:props.serviceId,format,datasets:chosen,filters:filtered?{...store?.filters,tests:props.testFilters,'test-matrix':props.testFilters}:{},csrfToken:props.csrfToken,comparison:props.comparisonMode&&comparison?{...comparison,request:comparisonExportBody(comparison.request,filtered)}:undefined};
   const file=await prepareExport(job,abort.signal,message=>{if(!abort.signal.aborted)setProgress(message)});
   if(abort.signal.aborted||currentFingerprint.current!==identity)return;
   saveExport(file.bytes,file.filename,file.type);setProgress('Файл подготовлен для скачивания.');
  }catch(cause){if(!abort.signal.aborted){setError(exportError(cause));setProgress('')}}finally{if(controller.current===abort){locked.current=false;if(!abort.signal.aborted)setBusy(false)}}
 }
 const notes=filtered?[...new Set([...chosen.flatMap(dataset=>store?.warnings[dataset]??[]),...(!props.comparisonMode&&chosen.includes('coverage')?['Фильтры графа и выделение его узлов не применяются. Для покрытия используются текущие фильтры таблицы схемы.']:[])])]:[];
 const hint=props.comparisonMode?`Один файл .${format}.`:chosen.length>1?(format==='csv'?'Один ZIP-архив с отдельными CSV-файлами.':'Один объединённый JSON с исходными метаданными наборов.'):`Один файл .${format}.`;
 return <dialog ref={dialog} className="export-dialog" aria-labelledby="export-title" onCancel={event=>{event.preventDefault();close()}} onClick={event=>{if(event.target===event.currentTarget)close()}}><div className="export-heading"><h2 id="export-title">{props.comparisonMode?'Экспорт сравнения прогонов':'Экспорт данных прогона'}</h2><button type="button" aria-label="Закрыть экспорт" onClick={close}>×</button></div><form onSubmit={event=>{event.preventDefault();void submit()}}><fieldset disabled={busy}><legend>Формат</legend><div className="export-format">{(['csv','json'] as const).map(value=><label key={value}><input type="radio" name="export-format" checked={format===value} onChange={()=>setFormat(value)}/>{value.toUpperCase()}</label>)}</div>{props.comparisonMode?<div className="export-comparison">{comparison?<><p>{comparison.names.join(' → ')}</p><p>Baseline: <code>{comparison.request.baselineRunId}</code><br/>Target: <code>{comparison.request.targetRunId}</code></p></>:<p>Сначала рассчитайте актуальное сравнение.</p>}</div>:<fieldset className="export-datasets"><legend>Какие данные включить</legend>{(Object.keys(datasetLabels) as Dataset[]).map(dataset=><label key={dataset}><input type="checkbox" checked={chosen.includes(dataset)} disabled={!allowed.includes(dataset)} onChange={event=>setSelected(old=>event.target.checked?[...old,dataset]:old.filter(item=>item!==dataset))}/><span>{datasetLabels[dataset]}{!allowed.includes(dataset)&&<small>Нужны права доступа к журналу</small>}</span></label>)}<button type="button" className="export-select-all" onClick={()=>setSelected(chosen.length===allowed.length?[]:allowed)}>{chosen.length===allowed.length?'Снять всё':'Выбрать всё'}</button><p>Схема и покрытие — каталог полей с метриками, без полного SDL.</p></fieldset>}<label className="export-filter-toggle"><input type="checkbox" checked={filtered} onChange={event=>setFiltered(event.target.checked)}/>Учитывать текущие фильтры</label><p>Если выключено, экспортируются все доступные данные выбранных разделов.</p>{props.comparisonMode&&filtered&&<p>Локальный фильтр типа в исследовании сравнения не применяется; выгружается выбранная категория всех типов.</p>}{notes.map(note=><p className="export-note" key={note}>{note}</p>)}<p>{hint}</p><p className="export-limit">До 32 МиБ исходных данных. Экспорт включает все страницы таблиц.</p></fieldset>{progress&&<p role="status" aria-live="polite">{progress}</p>}{error&&<p role="alert" className="export-error">{error}</p>}<div className="export-footer"><button type="button" className="run-control" onClick={close}>{busy?'Отменить':'Закрыть'}</button><button type="submit" className="run-control run-control-primary" disabled={blocked||busy||!enabled||!props.comparisonMode&&!chosen.length}>{props.comparisonMode?'Экспортировать сравнение':'Экспортировать'}</button></div></form></dialog>;
}
