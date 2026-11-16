import {useEffect,useState} from 'react';

import {readTheme,resolveTheme,saveTheme,type Theme} from './interfaceTheme';

const systemPreference='(prefers-color-scheme: dark)';

export function useInterfaceTheme() {
  const [theme,setTheme]=useState<Theme>(()=>readTheme({getItem:key=>window.localStorage.getItem(key)}));
  const [systemDark,setSystemDark]=useState(()=>window.matchMedia(systemPreference).matches);
  const effective=resolveTheme(theme,systemDark);

  useEffect(()=>{
    const media=window.matchMedia(systemPreference);
    function update(){setSystemDark(media.matches)}
    media.addEventListener('change',update);
    return ()=>media.removeEventListener('change',update);
  },[]);
  useEffect(()=>{
    document.documentElement.dataset.theme=effective;
    document.documentElement.style.colorScheme=effective;
  },[effective]);

  function choose(value:Theme){saveTheme({setItem:(key,choice)=>window.localStorage.setItem(key,choice)},value);setTheme(value)}
  return {theme,choose,effective};
}
