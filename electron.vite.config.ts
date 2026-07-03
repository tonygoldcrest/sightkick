import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  main: {
    build: { externalizeDeps: true, watch: {} },
  },
  preload: {
    build: { externalizeDeps: true },
  },
  renderer: {
    plugins: [tailwindcss(), react()],
    server: {
      watch: {
        ignored: ['**/*.test.*', '**/*.stories.*'],
      },
    },
  },
});
