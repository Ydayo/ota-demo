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
          name: 'harness',
          include: ['tooling/harness/**/*.test.ts'],
          exclude: ['**/node_modules/**', 'tooling/harness/fixtures/**'],
          testTimeout: 60_000,
        },
      },
    ],
  },
});
