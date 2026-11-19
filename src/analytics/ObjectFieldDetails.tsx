import {Kind,parse,print} from 'graphql';
import {CodeView} from './CodeView';
import {FieldArgumentUsage} from './FieldArgumentUsage';
import {useState} from 'react';
import type {GraphType} from '../model';
import type {SchemaCoordinate} from '../api/runPaths';
import {FieldResponseEvidence} from './FieldResponseEvidence';
import {FieldTestExecutions} from './RelatedTestExecutions';
import {FieldRequestPaths} from './FieldRequestPaths';
import './objectFieldDetails.css';

type FieldTab='Обзор'|'Тесты'|'Пути'|'SDL';
type Props={
 root?:{tab:FieldTab;onTab:(tab:FieldTab)=>void;declaration:string|null;sdlMessage?:string;schemaArgs:string[]};
 type:GraphType;field:GraphType['fields'][number];args:string[];description?:string|null;deprecationReason?:string|null;
 runId?:string|null;snapshotId?:string|null;scope:string;revision:number;allowed:boolean;showAnalyticsLinks:boolean;
 onType:(name:string,edgeId?:string)=>void;edgeId?:string;onTest?:(id:string)=>void;
 onHighlightPath?:(path:SchemaCoordinate[]|null)=>void;onFindPath?:(path:SchemaCoordinate[])=>void;onOperations:(field:string)=>void;onRequests:(field:string)=>void;
};
export function ObjectFieldDetails(p:Props){
 const [objectTab,setObjectTab]=useState<FieldTab>('Обзор');
 const tab=p.root?.tab??objectTab;
 const setTab=(next:FieldTab)=>p.root?p.root.onTab(next):setObjectTab(next);
 const tabs:FieldTab[]=p.root?['Обзор','Тесты','Пути','SDL']:['Обзор','Тесты','Пути'];
 const rootArguments=p.root?schemaArguments(p.root.schemaArgs.length?p.root.schemaArgs:p.args):[];
 const coordinate=p.type.name+'.'+p.field.name;
 return <div className={p.root?'object-field-details root-field-details':'object-field-details'}>
  <div className="object-field-heading">
   <small>ПОЛЕ · {p.type.name}</small><h2>{coordinate}</h2>
   <div className="detail-tabs schema-type-tabs" role="tablist" aria-label="Разделы подробностей поля">
    {tabs.map(name=><button key={name} type="button" role="tab" aria-selected={tab===name} onClick={()=>setTab(name)}>{name}</button>)}
   </div>
  </div>
  <div className="schema-detail-scroll object-field-content">
   {tab==='Обзор'?<>
    <div className="object-field-metrics">
     <div><small>Покрытие</small><strong data-covered={p.field.covered===null?'unknown':String(p.field.covered)}>{p.field.covered===null?'Нет данных':p.field.covered?'Покрыто':'Не покрыто'}</strong></div>
     <div><small>Hits</small><strong>{p.field.hits??'—'}</strong></div>
    </div>
    <FieldResponseEvidence embedded runId={p.runId} snapshotId={p.snapshotId} typeName={p.type.name} fieldName={p.field.name} scope={p.scope} revision={p.revision} allowed={p.allowed}/>
    <section><h3>Свойства поля</h3><dl className="object-field-properties">
     <div><dt>Родительский тип</dt><dd><button type="button" onClick={()=>p.onType(p.type.name)}>{p.type.name} →</button></dd></div>
     <div><dt>Возвращает</dt><dd>{p.field.targetType?<button type="button" onClick={()=>p.onType(p.field.targetType!,p.edgeId)}>{p.field.returnType} →</button>:<code>{p.field.returnType}</code>}</dd></div>
     {!p.root&&p.args.length>0&&<div><dt>Аргументы</dt><dd>{p.args.map(arg=><code key={arg}>{arg}</code>)}</dd></div>}
     {p.description&&<div><dt>Описание</dt><dd>{p.description}</dd></div>}
     <div><dt>Deprecated</dt><dd>{p.field.deprecated?p.deprecationReason??'Да':'Нет'}</dd></div>
    </dl></section>
    {p.root&&rootArguments.length>0&&<section className="root-field-arguments"><h3>Аргументы</h3>
     <ul>{rootArguments.map(argument=><li key={argument.name}><code>{argument.name}</code><span><code>{argument.type}</code>{argument.required&&Boolean(p.root?.schemaArgs.length)&&<small> · Обязательный</small>}</span></li>)}</ul>
     {p.root.sdlMessage&&<p role="status">{p.root.sdlMessage}</p>}
     <FieldArgumentUsage compact runId={p.runId} snapshotId={p.snapshotId} typeName={p.type.name} fieldName={p.field.name} scope={p.scope} revision={p.revision} allowed={p.allowed}/>
    </section>}
    {p.showAnalyticsLinks&&<section><h3>Использование в текущем прогоне</h3><div className="schema-detail-actions">
     <button type="button" onClick={()=>p.onOperations(coordinate)}>Показать операции</button>
     {p.allowed&&<button type="button" onClick={()=>p.onRequests(coordinate)}>Показать обращения</button>}
    </div></section>}
   </>:tab==='Тесты'?<FieldTestExecutions embedded runId={p.runId} typeName={p.type.name} fieldName={p.field.name} scope={p.scope} allowed={p.allowed} revision={p.revision} onOpen={p.onTest}/>
    :tab==='SDL'&&p.root?<section className="schema-sdl"><h3>Объявление поля</h3>{p.root.sdlMessage?<p role="status">{p.root.sdlMessage}</p>:p.root.declaration?<CodeView key={coordinate} code={p.root.declaration}/>:<p role="status">SDL-объявление выбранного поля недоступно.</p>}</section>
    :<FieldRequestPaths onHighlightPath={p.onHighlightPath} embedded runId={p.runId} snapshotId={p.snapshotId} field={{typeName:p.type.name,fieldName:p.field.name}} scope={p.scope} canSearch={p.allowed&&Boolean(p.onFindPath)} onFind={path=>p.onFindPath?.(path)}/>}
  </div>
 </div>;
}


function schemaArguments(args:string[]){
 if(!args.length)return [];
 try{
  const definition=parse('type Root { field('+args.join(',')+'): String }').definitions[0];
  if(definition.kind!==Kind.OBJECT_TYPE_DEFINITION)return [];
  return (definition.fields?.[0]?.arguments??[]).map(argument=>({
   name:argument.name.value,type:print(argument.type),
   required:argument.type.kind===Kind.NON_NULL_TYPE&&argument.defaultValue===undefined,
  }));
 }catch{return []}
}
