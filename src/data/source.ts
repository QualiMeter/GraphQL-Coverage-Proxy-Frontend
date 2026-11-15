import type { Coverage } from '../model';
import { mockCoverage } from './mock';
export type Scenario='final'|'first'|'empty';
export interface DataSource { load(scenario:Scenario):Promise<Coverage> }
export const mockSource:DataSource={load:async scenario=>mockCoverage(scenario)};
