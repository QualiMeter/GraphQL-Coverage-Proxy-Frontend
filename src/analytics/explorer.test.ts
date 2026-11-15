import {describe,expect,it} from 'vitest';
import type {SchemaType} from '../model';
import {explorerResults} from './explorer';

const types:SchemaType[]=[
 {name:'Query',kind:'OBJECT',role:'query',fields:[{name:'customer',returnType:'Customer',targetType:'Customer',covered:true,hits:3,deprecated:false},{name:'health',returnType:'String',targetType:null,covered:false,hits:0,deprecated:false}],coveragePercent:50,coveredFields:1,totalFields:2},
 {name:'Mutation',kind:'OBJECT',role:'mutation',fields:[{name:'createOrder',returnType:'Order',targetType:'Order',covered:false,hits:0,deprecated:false}],coveragePercent:0,coveredFields:0,totalFields:1},
 {name:'Customer',kind:'OBJECT',fields:[{name:'id',returnType:'ID!',targetType:null,covered:true,hits:2,deprecated:false}],coveragePercent:100,coveredFields:1,totalFields:1},
];

describe('Schema Explorer results',()=>{
 it('finds a field under its parent type without filtering the source types',()=>{
  const result=explorerResults(types,'customer','all','name','all');
  expect(result.map(item=>item.type.name)).toEqual(['Customer','Query']);
  expect(result.find(item=>item.type.name==='Query')?.fields.map(field=>field.name)).toEqual(['customer']);
  expect(types).toHaveLength(3);
 });
 it('combines root and coverage filters',()=>{
  expect(explorerResults(types,'','zero','name','mutation').map(item=>item.type.name)).toEqual(['Mutation']);
  expect(explorerResults(types,'','partial','name','all').map(item=>item.type.name)).toEqual(['Query']);
  expect(explorerResults(types,'','complete','name','all').map(item=>item.type.name)).toEqual(['Customer']);
 });
 it('shows root fields and sorts by uncovered count',()=>{
  const roots=explorerResults(types,'','all','name','query');
  expect(roots[0].fields.map(field=>field.name)).toEqual(['customer','health']);
  expect(explorerResults(types,'','all','uncovered','all').map(item=>item.type.name)).toEqual(['Mutation','Query','Customer']);
 });
});
