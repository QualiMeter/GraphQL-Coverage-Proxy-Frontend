export const themes=['light','dark','system'] as const;
export type Theme=typeof themes[number];
export const themeKey='coverage.theme';

export function readTheme(storage: Pick<Storage,'getItem'>): Theme {
  try {
    const saved=storage.getItem(themeKey);
    if(saved==='light'||saved==='dark')return saved;
  } catch { /* The system preference still works when storage is unavailable. */ }
  return 'system';
}

export function resolveTheme(theme:Theme,systemDark:boolean) {
  return theme==='system'?(systemDark?'dark':'light'):theme;
}

export function saveTheme(storage: Pick<Storage,'setItem'>,theme:Theme) {
  try {storage.setItem(themeKey,theme)}
  catch { /* The preference can still be applied for the current page. */ }
}
