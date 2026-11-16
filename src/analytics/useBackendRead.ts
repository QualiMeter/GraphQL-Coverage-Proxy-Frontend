import {useEffect, useState} from 'react';

export function useBackendRead<T>(key: string | null, load: (signal: AbortSignal) => Promise<T>) {
  const [result, setResult] = useState<{key: string; data?: T; error?: Error}>();
  useEffect(() => {
    if (!key) return;
    const controller = new AbortController();
    void load(controller.signal).then(data => {
      if (!controller.signal.aborted) setResult({key, data});
    }, (error: Error) => {
      if (!controller.signal.aborted) setResult({key, error});
    });
    return () => controller.abort();
  }, [key, load]);
  const current = key && result?.key === key ? result : undefined;
  return {data: current?.data, error: current?.error, loading: Boolean(key && !current)};
}
