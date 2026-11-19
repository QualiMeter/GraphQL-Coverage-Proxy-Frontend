import {useId,useState} from 'react';

export function MetricInfo({text}:{text:string}) {
 const [open,setOpen]=useState(false);
 const id=useId();
 return <span className="metric-info" onMouseEnter={()=>setOpen(true)} onMouseLeave={()=>setOpen(false)}>
  <button type="button" aria-label="Объяснение метрики" aria-expanded={open} aria-controls={id} aria-describedby={id}
   onFocus={()=>setOpen(true)} onBlur={()=>setOpen(false)} onClick={()=>setOpen(true)}
   onKeyDown={event=>{if(event.key==='Escape')setOpen(false)}}>ⓘ</button>
  <span id={id} role="tooltip" hidden={!open}>{text}</span>
 </span>;
}
