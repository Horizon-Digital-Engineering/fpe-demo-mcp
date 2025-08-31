import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.vitest.ts'], // All Vitest tests
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      exclude: ['tests/**', 'dist/**', 'node_modules/**'],
      reportsDirectory: './coverage'
    }
  }
});