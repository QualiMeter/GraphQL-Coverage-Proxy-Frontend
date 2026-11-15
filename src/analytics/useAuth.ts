import {useEffect, useState, useSyncExternalStore} from 'react';
import {createAuthSession} from './authSession';

export function useAuth() {
  const [controller] = useState(createAuthSession);
  const state = useSyncExternalStore(controller.subscribe, controller.snapshot);

  useEffect(() => {
    function recheck() {
      controller.expire();
      void controller.restore();
    }
    function onVisible() {
      if (document.visibilityState === 'visible') recheck();
    }
    recheck();
    window.addEventListener('focus', recheck);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      controller.cancelRestore();
      window.removeEventListener('focus', recheck);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [controller]);

  useEffect(() => {
    if (!state.session) return;
    const delay = Math.max(0, Date.parse(state.session.expiresAt) - Date.now());
    const timer = window.setTimeout(controller.expire, delay);
    return () => window.clearTimeout(timer);
  }, [controller, state.session]);

  return {...state, getCurrent: controller.snapshot, restore: controller.restore, signIn: controller.signIn, signOut: controller.signOut};
}
