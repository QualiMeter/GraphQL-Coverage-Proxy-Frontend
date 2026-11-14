import type { Coverage, Field, SchemaType } from '../model';
const f=(name:string,returnType:string,hits:number,targetType:string|null=null):Field=>({name,returnType,targetType,hits,covered:hits>0,deprecated:false});
const t=(name:string,role:SchemaType['role'],fields:Field[]):SchemaType=>({name,role,kind:'OBJECT',fields,totalFields:fields.length,coveredFields:fields.filter(x=>x.covered).length,coveragePercent:100*fields.filter(x=>x.covered).length/fields.length});
export function mockCoverage(scenario:'final'|'first'|'empty'='final'):Coverage {
 const active=scenario==='empty'?0:1, mutation=scenario==='final'?1:0;
 const types=[t('Query','query',[f('user','User',active,'User'),f('users','[User!]!',0,'User')]),t('Mutation','mutation',[f('createUser','User!',mutation,'User')]),t('User',undefined,[f('id','ID!',active+mutation),f('name','String!',active+mutation),f('email','String',0),f('orders','[Order!]!',active,'Order')]),t('Order',undefined,[f('id','ID!',0),f('total','Float!',active)])];
 const coveredFields=types.reduce((n,x)=>n+x.coveredFields,0);
 return {service:'Demo GraphQL API',schemaId:'demo-schema-v1',runId:scenario==='empty'?null:'demo-run-01',summary:{totalFields:9,coveredFields,coveragePercent:coveredFields/9*100},types};
}
