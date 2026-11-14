export type Field = { name:string; returnType:string; targetType:string|null; covered:boolean; hits:number; deprecated:boolean };
export type SchemaType = { name:string; kind:string; role?:'query'|'mutation'; fields:Field[]; coveragePercent:number; coveredFields:number; totalFields:number };
export type Coverage = { service:string; schemaId:string; runId:string|null; summary:{totalFields:number;coveredFields:number;coveragePercent:number}; types:SchemaType[] };
export const fieldId=(type:string,field:string)=>`${type}.${field}`;
