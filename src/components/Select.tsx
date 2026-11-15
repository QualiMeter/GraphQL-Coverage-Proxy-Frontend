import {useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent} from 'react';
import {createPortal} from 'react-dom';
import './select.css';

type SelectProps<Value extends string> = {
  label: string;
  options: readonly {value: Value; label: string}[];
  value: Value;
  onChange: (value: Value) => void;
  modified?: boolean;
};

export function Select<Value extends string>({label, options, value, onChange, modified}: SelectProps<Value>) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<CSSProperties | null>(null);
  const [highlight, setHighlight] = useState(0);
  const selected = options.findIndex(option => option.value === value);
  const open = position !== null;
  const optionId = (index: number) => `${id}-option-${index}`;

  function show() {
    const rect = trigger.current?.getBoundingClientRect();
    if (!rect) return;
    const edge = 8;
    const gap = 6;
    const viewportWidth = document.documentElement.clientWidth;
    const width = Math.min(Math.max(rect.width, 208), viewportWidth - edge * 2);
    const below = window.innerHeight - rect.bottom - gap - edge;
    const above = rect.top - gap - edge;
    const opensUp = below < Math.min(240, options.length * 44 + 12) && above > below;

    setHighlight(Math.max(0, selected));
    setPosition({
      width,
      left: Math.max(edge, Math.min(rect.left, viewportWidth - width - edge)),
      top: opensUp ? undefined : rect.bottom + gap,
      bottom: opensUp ? window.innerHeight - rect.top + gap : undefined,
      maxHeight: Math.max(0, Math.min(240, opensUp ? above : below)),
    });
  }

  function choose(index: number) {
    onChange(options[index].value);
    setPosition(null);
  }

  useEffect(() => {
    if (!open) return;
    function dismiss(event: Event) {
      if (menu.current?.contains(event.target as Node)) return;
      if (event.type === 'pointerdown' && trigger.current?.contains(event.target as Node)) return;
      setPosition(null);
    }
    document.addEventListener('pointerdown', dismiss);
    window.addEventListener('scroll', dismiss, true);
    window.addEventListener('resize', dismiss);
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      window.removeEventListener('scroll', dismiss, true);
      window.removeEventListener('resize', dismiss);
    };
  }, [open]);

  useEffect(() => {
    const list = menu.current;
    const option = list?.children[highlight] as HTMLElement | undefined;
    if (!list || !option) return;
    const start = option.offsetTop;
    const end = start + option.offsetHeight;
    if (start < list.scrollTop) list.scrollTop = start;
    if (end > list.scrollTop + list.clientHeight) list.scrollTop = end - list.clientHeight;
  }, [open, highlight]);

  function handleKey(event: KeyboardEvent<HTMLButtonElement>) {
    const {key} = event;
    if (key === 'ArrowDown' || key === 'ArrowUp') {
      event.preventDefault();
      if (!open) show();
      else setHighlight(index => Math.min(options.length - 1, Math.max(0, index + (key === 'ArrowDown' ? 1 : -1))));
    } else if (open && (key === 'Home' || key === 'End')) {
      event.preventDefault();
      setHighlight(key === 'Home' ? 0 : options.length - 1);
    } else if (open && (key === 'Enter' || key === ' ')) {
      event.preventDefault();
      choose(highlight);
    } else if (open && key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      setPosition(null);
    }
  }

  return (
    <div className="ui-select">
      <span className="ui-select-label" id={`${id}-label`}>{label}</span>
      <button
        ref={trigger}
        type="button"
        role="combobox"
        className="ui-select-trigger"
        data-modified={modified}
        aria-labelledby={`${id}-label`}
        aria-expanded={open}
        aria-controls={open ? `${id}-list` : undefined}
        aria-activedescendant={open ? optionId(highlight) : undefined}
        disabled={!options.length}
        onClick={() => open ? setPosition(null) : show()}
        onKeyDown={handleKey}
        onBlur={() => setPosition(null)}
      >
        <span>{options[selected]?.label}</span>
        <span className="ui-select-chevron" aria-hidden="true"/>
      </button>
      {open && createPortal(
        <div className="ui-select-menu" ref={menu} id={`${id}-list`} role="listbox" aria-labelledby={`${id}-label`} style={position}>
          {options.map((option, index) => (
            <div
              role="option"
              key={option.value}
              id={optionId(index)}
              aria-selected={index === selected}
              data-highlighted={index === highlight}
              onPointerMove={() => setHighlight(index)}
              onMouseDown={event => event.preventDefault()}
              onClick={() => choose(index)}
            >
              {option.label}
              {index === selected && <span aria-hidden="true">✓</span>}
            </div>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
}
