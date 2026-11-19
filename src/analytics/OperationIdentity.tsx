import {useState} from 'react';

export function OperationIdentity({operationKey}:{operationKey:string}){
 const [status,setStatus]=useState('');
 return <div className="operation-identity"><span title={operationKey}>ID структуры: {operationKey.length>12?operationKey.slice(0,12)+'…':operationKey}</span>
  <button type="button" aria-label="Копировать operationKey" title={operationKey} onClick={async event=>{
   event.stopPropagation();
   try{await navigator.clipboard.writeText(operationKey);setStatus('Скопировано')}
   catch{setStatus('Не удалось скопировать')}
  }}>Копировать</button><span role="status">{status}</span>
 </div>;
}
