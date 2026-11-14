import {it,expect} from 'vitest';
import {summaryDestination} from './navigation';
it('opens uncovered fields in the filtered table',()=>{expect(summaryDestination('uncovered')).toEqual({page:'schema',mode:'table',filter:'uncovered'})});
it('opens GraphQL errors in requests',()=>{expect(summaryDestination('graphql')).toEqual({page:'requests',filter:'graphql'})});
