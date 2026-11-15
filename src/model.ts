export type Field<Metric extends number | null = number> = {
 name:string;
 returnType:string;
 targetType:string|null;
 covered:Metric extends number ? boolean : null;
 hits:Metric;
 deprecated:boolean;
 relationId?:string;
 description?:string|null;
 deprecationReason?:string|null;
 args?:{name:string;type:string}[];
};
export type SchemaType<Metric extends number | null = number> = {
 name:string;
 kind:string;
 role?:'query'|'mutation'|'subscription';
 rootOperations?:readonly ('query'|'mutation'|'subscription')[];
 description?:string|null;
 fields:Field<Metric>[];
 coveragePercent:Metric;
 coveredFields:Metric;
 totalFields:number;
};
export type GraphType = SchemaType<number | null>;
export type GraphField = Field<number | null>;
export type Coverage = { service:string; schemaId:string; runId:string|null; summary:{totalFields:number;coveredFields:number;coveragePercent:number}; types:SchemaType[] };
export const fieldId=(type:string,field:string)=>`${type}.${field}`;
export const relationId=(type:string,field:string,target:string)=>`${fieldId(type,field)}->${target}`;
