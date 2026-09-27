import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          include: ['packages/**/*.test.ts', 'apps/**/*.test.ts'],
          exclude: ['**/node_modules/**', '**/*.integration.test.ts'],
        },
      },
      {
        test: {
          name: 'integration',
          include: ['packages/**/*.integration.test.ts', 'apps/**/*.integration.test.ts'],
          exclude: ['**/node_modules/**'],
          testTimeout: 120_000,
          hookTimeout: 180_000,
        },
      },
      {
        test: {
          name: 'harness',
          include: ['tooling/harness/**/*.test.ts'],
          exclude: ['**/node_modules/**', 'tooling/harness/fixtures/**'],
          testTimeout: 60_000,
        },
      },
    ],
  },
});
