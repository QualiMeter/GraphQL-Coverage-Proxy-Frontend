import type {RequestDetailOut} from './comparisonDtos';
export type GraphqlErrorInfo=Pick<RequestDetailOut,'graphqlHasErrors'|'graphqlErrorCount'|'graphqlErrorDetailsAvailability'|'graphqlErrorDetails'>;
const object=(value:unknown):value is Record<string,unknown>=>Boolean(value)&&typeof value==='object'&&!Array.isArray(value);
const integer=(value:unknown,min:number,max:number)=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=min&&value<=max;
const nullableString=(value:unknown)=>value===undefined||value===null||typeof value==='string';
export function validGraphqlErrors(data:Record<string,unknown>){
 if(data.graphqlErrorCount!==undefined&&data.graphqlErrorCount!==null&&!integer(data.graphqlErrorCount,0,1048576))return false;
 if(data.graphqlErrorDetailsAvailability!==undefined&&!['sanitized','truncated','unavailable'].includes(String(data.graphqlErrorDetailsAvailability)))return false;
 const rows=data.graphqlErrorDetails;
 if(rows===undefined||rows===null)return true;
 if(!Array.isArray(rows)||rows.length>20||new TextEncoder().encode(JSON.stringify(rows)).length>16*1024)return false;
 return rows.every(row=>object(row)&&nullableString(row.code)&&nullableString(row.safeMessage)&&(row.path===undefined||row.path===null||Array.isArray(row.path)&&row.path.length<=16&&row.path.every(segment=>typeof segment==='string'?segment.length<=64&&/^[_A-Za-z][_0-9A-Za-z]*$/.test(segment):integer(segment,0,1000000)))&&(row.locations===undefined||Array.isArray(row.locations)&&row.locations.length<=8&&row.locations.every(location=>object(location)&&integer(location.line,1,1000000)&&integer(location.column,1,1000000))));
}
