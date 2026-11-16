import {useEffect, useId, useRef, useState, type KeyboardEvent} from 'react';
import {createPortal} from 'react-dom';

type Item = {id:string;label:string;note?:string};
type Props = {
  label:string;value:string;items:Item[];empty:string;action?:string;onEdit?:()=>void;editLabel?:string;
  onSelect:(id:string)=>void;onAction?:()=>void;status?:string;retry?:()=>void;disabled?:boolean;directActionWhenEmpty?:boolean;
};

export function ContextChevron({up=false}:{up?:boolean}) {
  return <svg className="context-chevron" aria-hidden="true" width="18" height="18" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d={up?'m6 15 6-6 6 6':'m6 9 6 6 6-6'}/>
  </svg>;
}

export function ContextMenu(p:Props) {
  const [position,setPosition]=useState<{top:number;left:number;width:number;maxHeight:number} | null>(null);
  const [query,setQuery]=useState('');
  const id=useId(), trigger=useRef<HTMLButtonElement>(null), menu=useRef<HTMLDivElement>(null), search=useRef<HTMLInputElement>(null);
  const open=position!==null;
  const active=p.items.find(item=>item.id===p.value);
  const term=query.trim().toLocaleLowerCase('ru');
  const items=p.items.filter(item=>[item.label,item.note].some(value=>value?.toLocaleLowerCase('ru').includes(term)));
  const direct=!p.items.length&&p.directActionWhenEmpty;
  function close(restore=false) {
    setPosition(null);
    if(restore)trigger.current?.focus();
  }
  function show() {
    const rect=trigger.current?.getBoundingClientRect();
    if(!rect)return;
    const width=Math.min(Math.max(rect.width,320),420,window.innerWidth-24);
    const top=rect.bottom+6;
    setQuery('');
    setPosition({top,left:Math.max(12,Math.min(rect.left,window.innerWidth-width-12)),width,maxHeight:window.innerHeight-top-12});
  }
  useEffect(()=>{
    if(!open)return;
    search.current?.focus();
    function outside(event:PointerEvent) {
      const node=event.target as Node;
      if(!menu.current?.contains(node)&&!trigger.current?.contains(node))setPosition(null);
    }
    function resize(){setPosition(null)}
    document.addEventListener('pointerdown',outside);
    window.addEventListener('resize',resize);
    return ()=>{document.removeEventListener('pointerdown',outside);window.removeEventListener('resize',resize)};
  },[open]);
  function keys(event:KeyboardEvent) {
    if(event.key==='Escape'){
      event.preventDefault();close(true);return;
    }
    if(!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return;
    if(event.target===search.current&&['Home','End'].includes(event.key))return;
    const options=[...(menu.current?.querySelectorAll<HTMLButtonElement>('button')??[])];
    if(!options.length)return;
    event.preventDefault();
    const index=options.indexOf(document.activeElement as HTMLButtonElement);
    const next=event.key==='Home'?0:event.key==='End'?options.length-1:
      event.key==='ArrowDown'?(index+1)%options.length:index<=0?options.length-1:index-1;
    options[next].focus();
  }
  function action(callback:()=>void) {close(true);callback()}
  return <div className="context-selector">
    <button ref={trigger} className="context-trigger" type="button" aria-haspopup="dialog" aria-expanded={open}
      aria-controls={open?id:undefined} aria-label={`${p.label}: ${active?.label??p.empty}`} disabled={p.disabled}
      onClick={()=>direct?p.onAction?.():open?close():show()}
      onKeyDown={event=>{if(!open&&!direct&&event.key==='ArrowDown'){event.preventDefault();show()}}}>
      <span className="context-trigger-copy"><span>{p.label}</span><strong title={active?.label??p.empty}>{active?.label??p.empty}</strong></span>
      <ContextChevron/>
    </button>
    {position&&createPortal(<div id={id} ref={menu} role="dialog" aria-label={p.label} className="context-menu filtered-context-menu"
      style={{position:'fixed',...position}} onKeyDown={keys}
      onBlur={event=>{if(event.relatedTarget&&!event.currentTarget.contains(event.relatedTarget)&&event.relatedTarget!==trigger.current)close()}}>
      <input ref={search} value={query} onChange={event=>setQuery(event.target.value)} aria-label={`Поиск · ${p.label}`} placeholder="Поиск"/>
      <div className="context-options" role="group" aria-label={`Доступные варианты · ${p.label}`}>
        {items.map(item=><button type="button" key={item.id} aria-pressed={item.id===p.value}
          className={item.id===p.value?'selected':''} onClick={()=>action(()=>p.onSelect(item.id))}>
          <span><strong title={item.label}>{item.label}</strong>{item.note&&<small title={item.note}>{item.note}</small>}</span>
          {item.id===p.value&&<b aria-hidden="true">✓</b>}
        </button>)}
        {!items.length&&<p className="context-empty">{term?'Ничего не найдено':p.empty}</p>}
      </div>
      {p.status&&<p role="status" className="context-empty">{p.status}</p>}
      {(p.onAction&&p.action||p.onEdit||p.retry)&&<div className="context-action">
        {p.onAction&&p.action&&<button type="button" onClick={()=>action(p.onAction!)}>{p.action}</button>}
        {p.onEdit&&<button type="button" onClick={()=>action(p.onEdit!)}>{p.editLabel}</button>}
        {p.retry&&<button type="button" onClick={()=>action(p.retry!)}>Повторить загрузку</button>}
      </div>}
    </div>,document.body)}
  </div>;
}
