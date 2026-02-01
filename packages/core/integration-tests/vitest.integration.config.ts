import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    root: resolve(__dirname),
    include: ['suites/**/*.integration.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['../src/**/*.ts'],
      exclude: ['../src/**/*.d.ts'],
    },
    // Longer timeout for integration tests
    testTimeout: 30000,
    // Run tests sequentially by default for integration tests
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
});
