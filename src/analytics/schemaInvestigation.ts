import {Kind,parse,print} from 'graphql';
import {fieldId,relationId, type GraphType} from '../model';

export type Relation={id:string;source:string;field:string;target:string;covered?:boolean};
export type NestedRelation={first:Relation;second:Relation};
export type SchemaSelection={kind:'type'|'field';id:string};
export type Viewport={x:number;y:number;zoom:number};
export type InvestigationStep=SchemaSelection&{edgeId:string|null;tab:'Обзор'|'Связи'|'SDL'|'Тесты'|'Пути';viewport:Viewport};
export type InvestigationHistory={entries:InvestigationStep[];index:number};
export const emptyHistory:InvestigationHistory={entries:[],index:-1};
export const currentStep=(history:InvestigationHistory)=>history.entries[history.index]??null;
export function isQueryMutationRoot(type:GraphType){
 return type.kind==='OBJECT'&&(type.rootOperations?.some(role=>role==='query'||role==='mutation')||type.role==='query'||type.role==='mutation');
}
export function needsSchemaDetailSdl(step:InvestigationStep|null,types:GraphType[]){
 if(!step)return false;
 if(step.kind==='type')return step.tab==='SDL';
 const type=types.find(type=>type.name===step.id.slice(0,step.id.indexOf('.')));
 if(!type||!isQueryMutationRoot(type))return false;
 const args=type.fields.find(field=>fieldId(type.name,field.name)===step.id)?.args;
 return step.tab==='SDL'||args===undefined||(step.tab==='Обзор'&&args.length>0);
}
export function fieldSdl(snapshot:{sdl:string}|null,typeName:string,fieldName:string){
 if(!snapshot?.sdl)return null;
 try{
  const definitions=parse(snapshot.sdl).definitions.flatMap(definition=>{
   if((definition.kind!==Kind.OBJECT_TYPE_DEFINITION&&definition.kind!==Kind.OBJECT_TYPE_EXTENSION)||definition.name.value!==typeName)return [];
   const fields=definition.fields?.filter(field=>field.name.value===fieldName)??[];
   return fields.length?[{...definition,fields}]:[];
  });
  return definitions.length?definitions.map(definition=>print(definition)).join('\n\n'):null;
 }catch{return null}
}
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
 return types.flatMap(type=>type.fields.filter(field=>field.targetType&&names.has(field.targetType)).map(field=>({id:field.relationId??relationId(type.name,field.name,field.targetType!),source:type.name,field:field.name,target:field.targetType!,...(field.relationCovered===undefined?{}:{covered:field.relationCovered})})));
}
export function nestedRelations(typeName:string,relations:Relation[]):NestedRelation[]{
 const result:NestedRelation[]=[];
 for(const first of relations.filter(relation=>relation.source===typeName&&relation.target!==typeName)){
  for(const second of relations.filter(relation=>relation.source===first.target&&relation.target!==typeName&&relation.target!==first.target))result.push({first,second});
 }
 return result;
}
export function sdlMetadata(snapshot:{sdl:string}|null,typeName:string,fieldName?:string,includeExtensions=false){
 if(!snapshot?.sdl)return {definition:null,description:null,args:[] as string[],deprecationReason:null};
 try{
  const doc=parse(snapshot.sdl);
  const definitions=doc.definitions.filter(definition=>
   'name' in definition && definition.name?.value===typeName && (
    definition.kind===Kind.OBJECT_TYPE_DEFINITION || (includeExtensions&&definition.kind===Kind.OBJECT_TYPE_EXTENSION) || definition.kind===Kind.INTERFACE_TYPE_DEFINITION ||
    definition.kind===Kind.UNION_TYPE_DEFINITION || definition.kind===Kind.ENUM_TYPE_DEFINITION ||
    definition.kind===Kind.SCALAR_TYPE_DEFINITION || definition.kind===Kind.INPUT_OBJECT_TYPE_DEFINITION
   ));
  const field=definitions.flatMap(definition=>
   definition.kind===Kind.OBJECT_TYPE_DEFINITION || (includeExtensions&&definition.kind===Kind.OBJECT_TYPE_EXTENSION) || definition.kind===Kind.INTERFACE_TYPE_DEFINITION
    ? definition.fields ?? [] : []).find(item=>item.name.value===fieldName);
  const deprecated=field?.directives?.find(directive=>directive.name.value==='deprecated');
  const reason=deprecated?.arguments?.find(arg=>arg.name.value==='reason')?.value;
  return {definition:definitions.length?definitions.map(print).join('\n\n'):null,description:field?.description?.value??null,args:field?.arguments?.map(arg=>print(arg))??[],deprecationReason:reason?.kind===Kind.STRING?reason.value:deprecated?'No longer supported':null};
 }catch{return {definition:null,description:null,args:[] as string[],deprecationReason:null}}
}
