import {Kind,parse,print} from 'graphql';
import {relationId, type GraphType} from '../model';
import type {Snapshot} from './model';

export type Relation={id:string;source:string;field:string;target:string};
export type NestedRelation={first:Relation;second:Relation};
export type SchemaSelection={kind:'type'|'field';id:string};
export type Viewport={x:number;y:number;zoom:number};
export type InvestigationStep=SchemaSelection&{edgeId:string|null;tab:'Обзор'|'Связи'|'SDL';viewport:Viewport};
export type InvestigationHistory={entries:InvestigationStep[];index:number};
export const emptyHistory:InvestigationHistory={entries:[],index:-1};
export const currentStep=(history:InvestigationHistory)=>history.entries[history.index]??null;
export function pushStep(history:InvestigationHistory,step:InvestigationStep):InvestigationHistory{
 const current=currentStep(history);
 if(current?.kind===step.kind&&current.id===step.id&&current.edgeId===step.edgeId)return history;
 return {entries:[...history.entries.slice(0,history.index+1),step],index:history.index+1};
}
export function updateStep(history:InvestigationHistory,update:Partial<InvestigationStep>):InvestigationHistory{
 if(history.index<0)return history;
 return {...history,entries:history.entries.map((entry,index)=>index===history.index?{...entry,...update}:entry)};
}
export function moveStep(history:InvestigationHistory,direction:-1|1):InvestigationHistory{
 const index=history.index+direction;
 return index<0||index>=history.entries.length?history:{...history,index};
}
export function relationsFor(types:GraphType[]):Relation[]{
 const names=new Set(types.map(type=>type.name));
 return types.flatMap(type=>type.fields.filter(field=>field.targetType&&names.has(field.targetType)).map(field=>({id:field.relationId??relationId(type.name,field.name,field.targetType!),source:type.name,field:field.name,target:field.targetType!})));
}
export function nestedRelations(typeName:string,relations:Relation[]):NestedRelation[]{
 const result:NestedRelation[]=[];
 for(const first of relations.filter(relation=>relation.source===typeName&&relation.target!==typeName)){
  for(const second of relations.filter(relation=>relation.source===first.target&&relation.target!==typeName&&relation.target!==first.target))result.push({first,second});
 }
 return result;
}
export function sdlMetadata(snapshot:Pick<Snapshot,'sdl'>|null,typeName:string,fieldName?:string){
 if(!snapshot?.sdl)return {definition:null,description:null,args:[] as string[],deprecationReason:null};
 try{
  const doc=parse(snapshot.sdl);
  const definitions=doc.definitions.filter(definition=>
   'name' in definition && definition.name?.value===typeName && (
    definition.kind===Kind.OBJECT_TYPE_DEFINITION || definition.kind===Kind.INTERFACE_TYPE_DEFINITION ||
    definition.kind===Kind.UNION_TYPE_DEFINITION || definition.kind===Kind.ENUM_TYPE_DEFINITION ||
    definition.kind===Kind.SCALAR_TYPE_DEFINITION || definition.kind===Kind.INPUT_OBJECT_TYPE_DEFINITION
   ));
  const field=definitions.flatMap(definition=>
   definition.kind===Kind.OBJECT_TYPE_DEFINITION || definition.kind===Kind.INTERFACE_TYPE_DEFINITION
    ? definition.fields ?? [] : []).find(item=>item.name.value===fieldName);
  const deprecated=field?.directives?.find(directive=>directive.name.value==='deprecated');
  const reason=deprecated?.arguments?.find(arg=>arg.name.value==='reason')?.value;
  return {definition:definitions.length?definitions.map(print).join('\n\n'):null,description:field?.description?.value??null,args:field?.arguments?.map(arg=>print(arg))??[],deprecationReason:reason?.kind===Kind.STRING?reason.value:deprecated?'No longer supported':null};
 }catch{return {definition:null,description:null,args:[] as string[],deprecationReason:null}}
}
