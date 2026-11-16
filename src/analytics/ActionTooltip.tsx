import {useState, type ReactNode} from 'react';

export function ActionTooltip({label,children}:{label:string;children:ReactNode}) {
  const [dismissed,setDismissed]=useState(false);
  return <div className="action-tooltip" data-tooltip-dismissed={dismissed||undefined}
    onPointerEnter={()=>setDismissed(false)} onFocus={()=>setDismissed(false)}
    onClickCapture={()=>setDismissed(true)}>
    {children}
    <span className="action-tooltip-label" aria-hidden="true">{label}</span>
  </div>;
}
