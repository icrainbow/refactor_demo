import { defineConfig } from 'vitest/config';

export default defineConfig({
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
