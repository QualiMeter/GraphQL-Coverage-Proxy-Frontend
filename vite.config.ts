import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

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
