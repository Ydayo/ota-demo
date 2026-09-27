// ミューテーションテストの設定(ADR-0019)。閾値は tooling/harness/src/mutation/stryker.ts の other。
// container.ts は実行時の依存(環境変数、DB)を組み立てるコンポジションルートで、E2E で起動して確かめるため対象外にする。
import { strykerConfig } from '../../tooling/harness/src/mutation/stryker.ts';

export default strykerConfig({ kind: 'other', mutate: ['src/server/**/*.ts', '!src/server/container.ts'] });
