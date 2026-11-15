import {defineConfig, loadEnv} from 'vite';
import react from '@vitejs/plugin-react';

<<<<<<< HEAD
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
=======
export default defineConfig(({ command }) => ({
  plugins: [react()],
  // Local dev stays at / so /api proxy works; built assets live at /coverage/.
  base: command === 'build' ? '/coverage/' : '/',
  server: {
    // Local development stays same-origin from the browser's perspective.
    proxy: {
      '/api': {
        target: 'https://graphql.rebyte.fun',
        changeOrigin: true,
      },
    },
  },
}));
>>>>>>> origin/main
