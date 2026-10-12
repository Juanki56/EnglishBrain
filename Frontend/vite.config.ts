/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Debe coincidir con CORS_ORIGINS del Backend.
    port: 5173,
    strictPort: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    // Las pruebas que escriben mucho con userEvent superan los 5 s por defecto
    // cuando todas las baterías corren en paralelo.
    testTimeout: 15_000,
    // Valores fijos para las pruebas: no dependen del .env de nadie.
    env: {
      VITE_API_URL: 'http://api.test',
      VITE_SUPABASE_URL: 'https://example.supabase.co',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
    },
  },
});
