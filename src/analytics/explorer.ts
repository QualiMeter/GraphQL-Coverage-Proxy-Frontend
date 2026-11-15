import type {GraphField,GraphType} from '../model';

export type CoverageFilter='all'|'zero'|'partial'|'complete';
export type ExplorerSort='name'|'coverage'|'uncovered';
export type RootFilter='all'|'query'|'mutation'|'subscription';
export type ExplorerResult={type:GraphType;fields:GraphField[]};

const uncovered=(type:GraphType)=>type.coveredFields===null?-1:type.totalFields-type.coveredFields;

export function explorerResults(types:GraphType[],search:string,coverage:CoverageFilter,sort:ExplorerSort,root:RootFilter):ExplorerResult[]{
 const term=search.trim().toLocaleLowerCase();
 return types.filter(type=>{
  if(root!=='all'&&!(type.rootOperations?.includes(root)??type.role===root))return false;
  if(coverage!=='all'&&type.coveragePercent===null)return false;
  if(coverage==='zero'&&type.coveragePercent!==0)return false;
  if(coverage==='partial'&&(type.coveragePercent===null||type.coveragePercent<=0||type.coveragePercent>=100))return false;
  if(coverage==='complete'&&type.coveragePercent!==100)return false;
  return !term||type.name.toLocaleLowerCase().includes(term)||type.fields.some(field=>field.name.toLocaleLowerCase().includes(term));
 }).map(type=>{
  const nameMatches=type.name.toLocaleLowerCase().includes(term);
  const fields=root!=='all'&&(!term||nameMatches)?type.fields:term?type.fields.filter(field=>field.name.toLocaleLowerCase().includes(term)):[];
  return {type,fields};
 }).sort((a,b)=>{
  if(sort==='coverage')return (b.type.coveragePercent??-1)-(a.type.coveragePercent??-1)||a.type.name.localeCompare(b.type.name);
  if(sort==='uncovered')return uncovered(b.type)-uncovered(a.type)||a.type.name.localeCompare(b.type.name);
  return a.type.name.localeCompare(b.type.name);
 });
}
