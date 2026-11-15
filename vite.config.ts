import {defineConfig, loadEnv} from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({mode}) => {
  const {COVERAGE_API_PROXY_TARGET} = loadEnv(mode, '.', 'COVERAGE_API_PROXY_TARGET');
  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api/': {
          target: COVERAGE_API_PROXY_TARGET || 'https://graphql.rebyte.fun',
          changeOrigin: true,
        },
      },
    },
  };
});
