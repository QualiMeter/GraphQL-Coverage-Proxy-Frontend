import {defineConfig, loadEnv} from 'vite';
import react from '@vitejs/plugin-react';
import {developmentApiConfig} from './dev/apiProxy';

export default defineConfig(configEnv => {
  // These are server-only settings; never expose them through VITE_* or define.
  const env = loadEnv(configEnv.mode, '.', ['COVERAGE_API_PROXY_TARGET', 'COVERAGE_DEV_PROXY_PRODUCTION_AUTH']);
  const api = developmentApiConfig(configEnv, env);

  return {
    ...api,
    plugins: [react(), ...(api.plugins ?? [])],
    // Production frontend доступен по /coverage/.
    base: configEnv.command === 'build' ? '/coverage/' : '/',
  };
});
