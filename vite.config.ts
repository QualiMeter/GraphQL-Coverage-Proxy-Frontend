
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, '.', 'COVERAGE_API_PROXY_TARGET');

  return {
    plugins: [react()],

    // Production frontend доступен по /coverage/
    base: command === 'build' ? '/coverage/' : '/',

    // Локальный frontend перенаправляет API-запросы на backend
    server: {
      proxy: {
        '/api': {
          target:
            env.COVERAGE_API_PROXY_TARGET ||
            'https://graphql.rebyte.fun',
          changeOrigin: true,
        },
      },
    },
  };
});
