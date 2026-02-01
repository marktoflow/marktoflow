/**
 * Integration Test Setup
 *
 * Global setup for integration tests. Configures the test environment
 * and provides shared utilities.
 */

import { beforeAll, afterAll } from 'vitest';

// Silence console output during tests unless explicitly enabled
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeAll(() => {
  if (!process.env.VERBOSE_TESTS) {
    console.log = () => {};
    console.error = () => {};
    console.warn = () => {};
  }
});

afterAll(() => {
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});
