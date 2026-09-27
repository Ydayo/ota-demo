// E2E(Playwright。ADR-0019)。
// CI では事前に `pnpm --filter @ota/web build` を実行し、本番モード(next start)で検査する。
// ローカルでは起動中の開発サーバー(pnpm dev)があれば再利用し、なければ起動する。DB は pnpm infra:up で起動しておく。

import { defineConfig, devices } from '@playwright/test';

const ci = process.env['CI'] !== undefined;

export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.spec.ts',
  forbidOnly: ci,
  retries: 0,
  reporter: ci ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // pnpm を経由すると停止のシグナルが Next に届かないため、next を直接起動する
    command: `./node_modules/.bin/next ${ci ? 'start' : 'dev'} --port 3000`,
    cwd: '../apps/web',
    url: 'http://localhost:3000',
    reuseExistingServer: !ci,
    timeout: 120_000,
    gracefulShutdown: { signal: 'SIGTERM', timeout: 10_000 },
  },
});
