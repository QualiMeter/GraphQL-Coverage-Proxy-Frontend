import {it,expect} from 'vitest';
import {routePath} from './RoutedEdge';
it('uses a short cubic connection for clear neighboring cards',()=>{const path=routePath(100,20,400,80,{offset:0,obstacles:[]});expect(path).toMatch(/^M 100 20 C /);expect(path).toMatch(/400 80$/)});
it('changes route when a card blocks the direct connection',()=>{const clear=routePath(100,20,400,80,{offset:0,obstacles:[]});const blocked=routePath(100,20,400,80,{offset:0,obstacles:[{x:220,y:20,width:50,height:65}]});expect(blocked).not.toBe(clear);expect(blocked.match(/ C /g)?.length).toBe(3)});
it('keeps backward connections local',()=>{const path=routePath(400,40,100,80,{offset:0,obstacles:[]});expect(path).toMatch(/100 80$/);expect(path).not.toContain('235')});
