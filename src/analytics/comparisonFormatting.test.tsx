import {describe,it,expect} from 'vitest';
import {formatComparisonNumber,signed} from './RunComparison';
describe('comparison display formatting',()=>{
 it('rounds floating point noise only for display',()=>{expect(formatComparisonNumber(108.69999999999993)).toBe('108,7');expect(formatComparisonNumber(91.428571)).toBe('91,43')});
 it('formats direction and suppresses negative zero',()=>{expect(signed(-13.72999999)).toBe('−13,73');expect(signed(40)).toBe('+40');expect(signed(-0.001)).toBe('0');expect(formatComparisonNumber(-0)).toBe('0')});
 it('keeps unavailable values distinct from zero',()=>{for(const value of [null,undefined,NaN,Infinity]){expect(formatComparisonNumber(value)).toBe('—');expect(signed(value)).toBe('—')}});
});
