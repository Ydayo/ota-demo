// ミューテーションテストの設定(ADR-0019)。閾値は tooling/harness/src/mutation/stryker.ts の other。
import { strykerConfig } from '../../tooling/harness/src/mutation/stryker.ts';

export default strykerConfig({ kind: 'other' });
