// ミューテーションテスト(Stryker)の共通設定(ADR-0019)。
// 各パッケージの stryker.config.mjs がこれを読み込み、パッケージの種類(閾値)と変異させるファイルを指定する。
// Stryker の閾値はパス単位で持てないため、パッケージ単位で設定する(ADR-0012)。
// 閾値を下げるには ADR が必要(憲法 第3条)。

import { fileURLToPath } from 'node:url';

/**
 * 閾値(ミューテーションスコアの %)。break を下回ると失敗する。
 * - domain: 業務ロジックを含むパッケージ(packages/modules/*、packages/products/*、packages/shared)
 * - other: 技術基盤とプレゼンテーション層(packages/platform、apps/web)
 */
export const THRESHOLDS = {
  domain: { high: 90, low: 80, break: 80 },
  other: { high: 80, low: 60, break: 60 },
} as const;

export type PackageKind = keyof typeof THRESHOLDS;

/** 変異させるファイル。パッケージのすべてのソースを対象にし、対象外は exclude で明示させる */
export const MUTATE_ALL = '**/*.{ts,tsx,mts,cts}';

/** どのパッケージでも変異させないもの(テスト、型宣言、生成物) */
export const ALWAYS_EXCLUDED = ['**/*.test.ts', '**/*.test.tsx', '**/*.d.ts', '.next/**'] as const;

/** Stryker 用の Vitest 設定。各パッケージの設定がこれを使っていることを自己テストで検査する */
export const VITEST_CONFIG_FILE = fileURLToPath(new URL('vitest.config.ts', import.meta.url));

export type StrykerOptions = {
  /** パッケージの種類。閾値を決める */
  readonly kind: PackageKind;
  /** 変異させないファイル(パッケージのディレクトリ基準の glob)。理由を設定ファイルのコメントに書く */
  readonly exclude?: readonly string[];
};

export const strykerConfig = ({ kind, exclude = [] }: StrykerOptions) => ({
  // pnpm の配置では Stryker がプラグインを自動で見つけられないため、パスで指定する
  plugins: [fileURLToPath(import.meta.resolve('@stryker-mutator/vitest-runner'))],
  testRunner: 'vitest',
  vitest: { configFile: VITEST_CONFIG_FILE },
  mutate: [MUTATE_ALL, ...[...ALWAYS_EXCLUDED, ...exclude].map((p) => `!${p}`)],
  // 生成物をサンドボックスにコピーしない
  ignorePatterns: ['.next', 'reports', 'test-results', 'playwright-report'],
  thresholds: THRESHOLDS[kind],
  // allowEmpty は既定の false のままにする。true にすると、テストが0件のときにスコアを計算せずに成功するため、
  // テストのないコードが素通りする。変異させるコードがないパッケージは、実行用のスクリプト(run.ts)がスキップする。
  reporters: ['clear-text', 'progress', 'html', 'json'],
  htmlReporter: { fileName: 'reports/mutation/index.html' },
  jsonReporter: { fileName: 'reports/mutation/mutation.json' },
  tempDirName: '.stryker-tmp',
  // 失敗したときもサンドボックスを残さない(残ると lint や依存ルールの検査の対象に紛れ込む)
  cleanTempDir: 'always',
});
