import {ApiError} from './client';
export const MAX_EXPORT_BYTES=32*1024*1024;
export type ExportFormat='json'|'csv';
export function exportError(error:unknown){
 if(error instanceof ApiError){const message:Record<number,string>={401:'Войдите в систему для экспорта.',403:'Недостаточно прав для экспорта.',404:'Прогон недоступен или не найден.',409:'Прогоны несовместимы для сравнения.',413:'Экспорт слишком большой. Сузьте фильтры или выберите меньше наборов.',422:'Некорректные параметры экспорта.',503:'Подготовка файла временно недоступна. Повторите позже.'};return message[error.status??0]??error.message}
 return error instanceof Error?error.message:'Не удалось подготовить экспорт.';
}
export function safeFilename(disposition:string|null,fallback:string,extension:string){
 let name:string|undefined;
 const encoded=disposition?.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
 try{name=encoded?decodeURIComponent(encoded.trim()):disposition?.match(/filename="([^"]*)"|filename=([^;]+)/i)?.slice(1).find(Boolean)}catch{/* Use the generated name for malformed headers. */}
 name=name?.trim();
 return name&&name.length<=180&&![...name].some(char=>char.charCodeAt(0)<32||char.charCodeAt(0)===127)&&!/[/\\<>:"|?*]/.test(name)&&!name.startsWith('.')&&name.toLowerCase().endsWith(`.${extension}`)?name:fallback;
}
export async function fetchExport(path:`/api/${string}`,{format,fallback,signal,body,csrfToken,maxBytes=MAX_EXPORT_BYTES}:{format:ExportFormat;fallback:string;signal:AbortSignal;body?:unknown;csrfToken?:string;maxBytes?:number}){
 const headers=new Headers({Accept:format==='json'?'application/json':'text/csv'});
 if(body!==undefined){headers.set('Content-Type','application/json');if(csrfToken)headers.set('X-CSRF-Token',csrfToken)}
 let response:Response;
 try{response=await fetch(path,{method:body===undefined?'GET':'POST',headers,body:body===undefined?undefined:JSON.stringify(body),credentials:'same-origin',cache:'no-store',redirect:'error',signal})}catch(error){if(signal.aborted)throw error;throw new ApiError('network','Не удалось подключиться к API экспорта.',undefined,error)}
 if(!response.ok){void response.body?.cancel().catch(()=>{});throw new ApiError('http',`Ошибка экспорта HTTP ${response.status}.`,response.status)}
 if(signal.aborted){void response.body?.cancel().catch(()=>{});throw new DOMException('Экспорт отменён','AbortError')}
 if(!response.headers.get('Content-Type')?.toLowerCase().includes(format==='json'?'application/json':'text/csv')){void response.body?.cancel().catch(()=>{});throw new Error('API вернул неожиданный формат файла экспорта.')}
 if(Number(response.headers.get('Content-Length'))>maxBytes){void response.body?.cancel().catch(()=>{});throw new ApiError('http','Превышен лимит файла.',413)}
 const chunks:Uint8Array[]=[];let size=0;
 const reader=response.body?.getReader();
 if(!reader)throw new Error('API не вернул файл экспорта.');
 try{while(true){if(signal.aborted)throw new DOMException('Экспорт отменён','AbortError');const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>maxBytes)throw new ApiError('http','Превышен лимит файла.',413);chunks.push(value)}}catch(error){await reader.cancel().catch(()=>{});if(signal.aborted||error instanceof ApiError)throw error;throw new ApiError('network','Соединение прервано при скачивании экспорта.',undefined,error)}finally{reader.releaseLock()}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}
 return {bytes,filename:safeFilename(response.headers.get('Content-Disposition'),fallback,format)};
}
export function saveExport(bytes:Uint8Array,filename:string,type:string){
 const blob=new Blob([new Uint8Array(bytes)],{type}),url=URL.createObjectURL(blob),anchor=document.createElement('a');
 try{anchor.href=url;anchor.download=filename;anchor.hidden=true;document.body.append(anchor);anchor.click()}catch(error){URL.revokeObjectURL(url);throw error}finally{anchor.remove()}
 // Allow the browser to start reading the download before releasing its URL.
 setTimeout(()=>URL.revokeObjectURL(url),1000);
}
