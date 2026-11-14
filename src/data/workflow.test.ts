import {describe,it,expect} from 'vitest';
import {stageFor,workflowStatus} from './workflow';
describe('workflow',()=>{it('orders preparation states',()=>{expect(['no-service','no-schema','no-run','active','first','final'].map(x=>stageFor(x as Parameters<typeof stageFor>[0]))).toEqual(['service','schema','run','tests','analysis','analysis'])});it('never presents unavailable API mutation as active',()=>{expect(workflowStatus('no-run',false).disabled).toBe(true)})});
