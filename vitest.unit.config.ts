import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
  test: {
    include: [
      'tests/unit/**/*.test.ts',
    ],
    globalSetup: [],
    setupFiles: [],
    pool: 'forks',
    poolOptions: {
      forks: {
        minForks: 1,
        maxForks: 1,
      },
    },
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
