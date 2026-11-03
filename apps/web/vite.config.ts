import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@hecate/core': path.resolve(import.meta.dirname, '../../packages/core/src'),
      '@hecate/storage': path.resolve(import.meta.dirname, '../../packages/storage/src'),
      '@hecate/ai': path.resolve(import.meta.dirname, '../../packages/ai/src'),
      '@hecate/ui': path.resolve(import.meta.dirname, '../../packages/ui/src'),
    },
  },
  build: {
    rollupOptions: {
      external: ['@tauri-apps/plugin-sql'],
    },
  },
  server: {
    port: 5173,
  },
});
