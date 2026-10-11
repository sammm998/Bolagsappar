import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// VITE_BASE=/app/ när plattformen serveras under hemsidan (en tjänst, se Dockerfile). Standard är roten.
export default defineConfig({
  base: process.env.VITE_BASE || '/',
  plugins: [react()],
  server: { port: 5173, host: true },
  preview: { port: 4173, host: true },
  build: { target: 'es2022', sourcemap: true, chunkSizeWarningLimit: 1500 },
  optimizeDeps: { include: ['xlsx'] }
});
