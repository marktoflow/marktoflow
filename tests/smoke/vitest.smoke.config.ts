import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@marktoflow/core': path.resolve(__dirname, '../../packages/core/src/index.ts'),
      '@marktoflow/gui': path.resolve(__dirname, '../../packages/gui/src/server/index.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/smoke/**/*.test.ts'],
    testTimeout: 30000,
  },
});
