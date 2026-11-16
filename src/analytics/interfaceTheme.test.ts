import {expect,it,vi} from 'vitest';
import {readTheme,resolveTheme,saveTheme,themeKey} from './interfaceTheme';

it('uses the system palette until the user chooses an explicit theme',()=>{
  expect(resolveTheme(readTheme({getItem:()=>null}),true)).toBe('dark');
  expect(resolveTheme(readTheme({getItem:()=>'invalid'}),false)).toBe('light');
  expect(resolveTheme('system',false)).toBe('light');
});

it('persists the selected scheme regardless of the system setting',()=>{
  let stored:string|null=null;
  const storage={getItem:vi.fn(()=>stored),setItem:vi.fn((_key:string,value:string)=>{stored=value})};
  saveTheme(storage,'dark');
  expect(storage.setItem).toHaveBeenCalledWith(themeKey,'dark');
  expect(resolveTheme(readTheme(storage),false)).toBe('dark');
  saveTheme(storage,'light');
  expect(resolveTheme(readTheme(storage),true)).toBe('light');
});

it('can display a theme with blocked local storage',()=>{
  const error=()=>{throw new Error('storage unavailable')};
  expect(readTheme({getItem:error})).toBe('system');
  expect(()=>saveTheme({setItem:error},'dark')).not.toThrow();
});
