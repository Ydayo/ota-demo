// Stryker(vitest-runner)用の Vitest 設定。
// Stryker はパッケージのディレクトリをサンドボックスにコピーして、その中で Vitest を実行する。
// ルートの vitest.config.ts はリポジトリのルート基準の include と projects を持ち、
// vitest-runner は projects から1つを選べないため(stryker-js#6215)、サンドボックスを root とする設定を別に用意する。

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    root: process.cwd(),
    include: ['**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/*.integration.test.ts', '**/.stryker-tmp/**'],
  },
});
