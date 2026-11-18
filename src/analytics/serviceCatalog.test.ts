import {describe,it,expect} from 'vitest';
import {combineServices,availableServiceId} from './serviceCatalog';
const service={id:'api-service',name:'Real API',key:'real',isPublic:true,createdAt:'2026-11-15',updatedAt:'2026-11-15'};
describe('backend service catalog',()=>{
 it('contains only services returned by the API',()=>{expect(combineServices([service])).toEqual([{id:service.id,name:service.name,endpointUrl:null,source:'backend'}]);expect(combineServices([])).toEqual([])});
 it('replaces stale selections with an available backend service',()=>{for(const id of ['','customer','mock:customer','deleted-service'])expect(availableServiceId(id,combineServices([service]))).toBe(service.id)});
 it('keeps a valid selection and clears it when the catalog is empty',()=>{expect(availableServiceId(service.id,combineServices([service]))).toBe(service.id);expect(availableServiceId('customer',[])).toBe('')});
});
