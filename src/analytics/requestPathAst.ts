import {buildSchema,validateSchema,parse,validate,specifiedRules,ValuesOfCorrectTypeRule,Kind,getNamedType,isCompositeType,isObjectType,isInterfaceType,isAbstractType,doTypesOverlap,type GraphQLSchema,type GraphQLCompositeType,type SelectionSetNode,type DirectiveNode,type FragmentDefinitionNode} from 'graphql';
import type {SchemaCoordinate} from '../api/runPaths';
import type {RequestDetail} from '../api/runAnalytics';
export type PathMatch={state:'match'|'no-match'|'unverified';reason?:string};
const unknown=(reason:string):PathMatch=>({state:'unverified',reason});
export function buildPathSchema(sdl:string){const schema=buildSchema(sdl);if(validateSchema(schema).length)throw new Error('SDL не образует корректную GraphQL-схему.');return schema}

export function matchRequestPath(schema:GraphQLSchema|null,request:Pick<RequestDetail,'operationName'|'operationType'|'safeGraphqlDocument'|'documentAvailability'>,path:readonly SchemaCoordinate[]):PathMatch {
 if(!schema)return unknown('Схему соответствующего снимка невозможно построить.');
 if(!path.length)return unknown('Последовательность пути пуста.');
 if(path.some(c=>{const owner=schema.getType(c.typeName);return !(isObjectType(owner)||isInterfaceType(owner))||!owner.getFields()[c.fieldName]}))return unknown('Координаты пути отсутствуют в схеме выбранного снимка.');
 if(!['available','redacted'].includes(request.documentAvailability??'')||!request.safeGraphqlDocument)return unknown('Безопасный GraphQL-документ недоступен.');
 try{
  const document=parse(request.safeGraphqlDocument,{maxTokens:20000});
  // Masked argument values can violate input types. They do not change the
  // structural field path; all other schema/document validation still applies.
  const errors=validate(schema,document,specifiedRules.filter(rule=>rule!==ValuesOfCorrectTypeRule));
  if(errors.length)return unknown('Документ не удалось однозначно сопоставить со схемой снимка.');
  const operations=document.definitions.filter(d=>d.kind===Kind.OPERATION_DEFINITION);
  const matches=request.operationName?operations.filter(o=>o.name?.value===request.operationName):operations.length===1?operations:[];
  if(matches.length!==1)return unknown('Невозможно определить выполненную операцию в документе.');
  const operation=matches[0];
  if(request.operationType&&request.operationType!==operation.operation)return unknown('Тип операции не совпадает с метаданными обращения.');
  const root=operation.operation==='query'?schema.getQueryType():operation.operation==='mutation'?schema.getMutationType():schema.getSubscriptionType();
  if(!root)return unknown('Корневой тип операции отсутствует в снимке.');
  const fragments=new Map(document.definitions.filter(d=>d.kind===Kind.FRAGMENT_DEFINITION).map(f=>[f.name.value,f as FragmentDefinitionNode]));
  const redacted=request.documentAvailability==='redacted';
  // Unknown variable values and masked conditions cannot prove that a branch
  // was selected. Explicit concrete fragment types do identify coordinates,
  // but never prove that resolvers actually executed.
  function condition(directives:readonly DirectiveNode[]|undefined):'yes'|'no'|'maybe'{
   let result:'yes'|'maybe'='yes';
   for(const directive of directives??[]){
    if(!['skip','include'].includes(directive.name.value)){result='maybe';continue}
    const value=directive.arguments?.find(a=>a.name.value==='if')?.value;
    if(redacted||value?.kind!==Kind.BOOLEAN){result='maybe';continue}
    if(directive.name.value==='skip'?value.value:!value.value)return 'no';
   }
   return result;
  }
  let budget=20000;
  function walk(selection:SelectionSetNode,parent:GraphQLCompositeType,index:number,certain:boolean,stack:Set<string>):PathMatch {
   let uncertain=false;
   for(const node of selection.selections){
    if(--budget<0)return unknown('Превышен безопасный объём анализа документа.');
    const gate=condition(node.directives);if(gate==='no')continue;
    const trusted=certain&&gate==='yes';
    let found:PathMatch={state:'no-match'};
    if(node.kind===Kind.FIELD){
     const expected=path[index];
     if(node.name.value!==expected.fieldName)continue;
     let exact=parent.name===expected.typeName;
     if(!exact){
      const expectedParent=schema!.getType(expected.typeName);
      if(!(isAbstractType(parent)&&expectedParent&&isCompositeType(expectedParent)&&doTypesOverlap(schema!,parent,expectedParent)))continue;
      // Never infer a concrete owner from an interface/union's runtime type.
      exact=false;
     }
     const definition=(isObjectType(parent)||isInterfaceType(parent))?parent.getFields()[node.name.value]:undefined;
     if(!definition){uncertain=true;continue}
     if(index===path.length-1){found=trusted&&exact?{state:'match'}:unknown('Путь зависит от неизвестного условия или неоднозначного типа.')}else if(node.selectionSet){
      const child=getNamedType(definition.type);
      if(isCompositeType(child))found=walk(node.selectionSet,child,index+1,trusted&&exact,stack);
     }
    }else{
     const fragment=node.kind===Kind.FRAGMENT_SPREAD?fragments.get(node.name.value):node;
     if(!fragment||node.kind===Kind.FRAGMENT_SPREAD&&stack.has(node.name.value))return unknown('Неразрешимый или циклический фрагмент.');
     const narrowed=fragment.typeCondition?schema!.getType(fragment.typeCondition.name.value):parent;
     if(!narrowed||!isCompositeType(narrowed)||!doTypesOverlap(schema!,parent,narrowed))continue;
     const fragmentGate=condition(fragment.directives);if(fragmentGate==='no')continue;
     const next=new Set(stack);if(node.kind===Kind.FRAGMENT_SPREAD)next.add(node.name.value);
     found=walk(fragment.selectionSet,narrowed,index,trusted&&fragmentGate==='yes',next);
    }
    if(found.state==='match')return found;
    if(found.state==='unverified')uncertain=true;
   }
   return uncertain?unknown('Неизвестные условия или типы не позволяют подтвердить этот путь.'):{state:'no-match'};
  }
  const opGate=condition(operation.directives);
  return opGate==='no'?{state:'no-match'}:walk(operation.selectionSet,root,0,opGate==='yes',new Set());
 }catch{return unknown('Документ не удалось разобрать или проверить в безопасных пределах.')}
}
