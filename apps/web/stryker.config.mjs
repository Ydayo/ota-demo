// ミューテーションテストの設定(ADR-0019)。閾値は tooling/harness/src/mutation/stryker.ts の other。
import { strykerConfig } from '../../tooling/harness/src/mutation/stryker.ts';

export default strykerConfig({
  kind: 'other',
  exclude: [
    // 画面と Hono のマウント先。E2E で起動して確かめる
    'src/app/**',
    // 実行時の依存(環境変数、DB)を組み立てるコンポジションルート。E2E で起動して確かめる
    'src/server/container.ts',
    // Next.js の設定
    'next.config.ts',
  ],
});
