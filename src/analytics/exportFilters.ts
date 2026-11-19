import type {AdvancedFilters,CoverageFilter} from './coverageTableFilters';
import type {JournalQuery} from '../api/runAnalytics';
import type {OperationAdvancedFilters,OperationErrorFilter} from './runAnalyticsModel';
export function operationExportBlocked(search:string,errors:readonly OperationErrorFilter[],advanced:OperationAdvancedFilters){
 return Boolean(search.trim()||errors.length>0&&errors.length<3&&!(errors.length===2&&errors.includes('http')&&errors.includes('graphql'))||
  advanced.frequency||advanced.duration||advanced.coverage||advanced.anonymous);
}
export function coverageExportFilters(query:string,filter:CoverageFilter,sort:string,typeName:string,advanced:AdvancedFilters){
 const ranges={zero:{minHits:0,maxHits:0},low:{minHits:1,maxHits:5},medium:{minHits:6,maxHits:20},high:{minHits:21}};
 return {search:query.trim()||undefined,covered:filter==='all'?undefined:filter==='covered',typeName:typeName||undefined,...(advanced.hits==='all'?{}:ranges[advanced.hits]),returns:advanced.returns==='all'?undefined:advanced.returns,deprecated:advanced.deprecated==='all'?undefined:advanced.deprecated==='yes',sortBy:sort==='type-field'?'coordinate':sort==='hits'||sort==='hits-asc'?'hits':'fieldName',sortOrder:sort==='hits'?'desc':'asc'};
}
export function operationExportFilters(search:string,kind:string,field:string,errors:boolean,order:string){const [typeName,fieldName]=field.split('.');return {search:search.trim()||undefined,operationType:kind||undefined,typeName:typeName||undefined,fieldName:fieldName||undefined,hasErrors:errors||undefined,sortBy:order,sortOrder:'desc'}}
export function requestExportFilters(query:JournalQuery,group:string){return {...query,errorGroup:group||undefined}}
