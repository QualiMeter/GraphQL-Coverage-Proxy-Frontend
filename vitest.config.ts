import {defineConfig} from 'vitest/config';
import react from '@vitejs/plugin-react';

// Tests must never load the production auth proxy from a developer's .env.local.
export default defineConfig({plugins: [react()]});
