import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['release/app/dist', 'out'],
    moduleNameMapper: {
      '\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$':
        '<rootDir>/src/__mocks__/fileMock.js',
      '\\.(css|less|sass|scss)$': 'identity-obj-proxy',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'json-summary', 'html'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.{test,spec}.{ts,tsx}',
        'src/**/*.stories.tsx',
        'src/**/*.d.ts',
        'src/__tests__/**',
        'src/__mocks__/**',
        'src/**/test-support.{ts,tsx}',
        'src/**/drumMidiFixture.ts',
        'src/main/index.ts',
        'src/main/AppUpdater.ts',
        'src/main/menu.ts',
        'src/main/ipc/midi.ts',
        'src/preload/**',
        'src/renderer/index.tsx',
      ],
    },
  },
  resolve: {
    alias: {
      src: path.resolve(__dirname, 'src'),
    },
  },
});
