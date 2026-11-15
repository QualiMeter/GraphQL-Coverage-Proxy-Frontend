import type {Service,Store} from './model';

export function validateEndpoint(input:string):string{
 let url:URL;
 try{url=new URL(input.trim())}catch{throw new Error('Укажите корректный URL GraphQL endpoint')}
 const local=['localhost','127.0.0.1','[::1]'].includes(url.hostname);
 if(url.protocol!=='https:'&&!(url.protocol==='http:'&&local))throw new Error('Используйте HTTPS; HTTP доступен только для localhost');
 if(url.username||url.password||url.search||url.hash||/(?:token|secret|password|api[-_]?key)(?:[=/:]|$)/i.test(decodeURIComponent(url.pathname)))throw new Error('URL не должен содержать логин, пароль, токен, параметры или фрагмент');
 return url.toString();
}
export function addLocalService(store:Store,input:{name:string;endpointUrl:string;description:string},id:string,createdAt:string):Store{
 const name=input.name.trim();
 if(!name)throw new Error('Укажите название сервиса');
 const endpointUrl=validateEndpoint(input.endpointUrl);
 const service:Service={id,name,endpointUrl,description:input.description.trim(),createdAt};
 return {...store,services:[...store.services,service]};
}
export type IntrospectionResult={status:'unavailable';message:string}|{status:'success';sdl:string}|{status:'error';message:string};
export async function schemaByIntrospection(service:Pick<Service,'endpointUrl'>):Promise<IntrospectionResult>{
 if(!service.endpointUrl)return {status:'unavailable',message:'У сервиса не указан GraphQL endpoint URL.'};
 return {status:'unavailable',message:'Получение схемы через introspection будет доступно после подключения backend.'};
}
