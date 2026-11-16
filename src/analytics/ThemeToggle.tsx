import {AccountIcon} from './AccountIcon';

export function ThemeToggle({dark,onToggle}:{dark:boolean;onToggle:()=>void}) {
  const label=dark?'Включить светлую тему':'Включить тёмную тему';
  return <button type="button" className="theme-toggle" aria-label={label} title={label} onClick={onToggle}>
    <AccountIcon name={dark?'light':'dark'}/>
  </button>;
}
