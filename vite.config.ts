import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Keep API routes at /api/... while the frontend is served at /coverage/.
  base: '/coverage/',
  server: {
    // Local development stays same-origin from the browser's perspective.
    proxy: {
      '/api': {
        target: 'https://graphql.rebyte.fun',
        changeOrigin: true,
      },
    },
  },
});
