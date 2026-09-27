// ミューテーションテストの実行(ADR-0019)。違反や失敗があれば終了コード 1 で終わる。
//   node tooling/harness/src/mutation/run.ts            すべてのパッケージ(設定ファイルの有無も検査する)
//   node tooling/harness/src/mutation/run.ts <dir>...   指定したパッケージのみ(プロジェクトルート基準のパス)
//
// - apps/ と packages/ の各パッケージに stryker.config.mjs があること(テスト用の偽物の apps/fake-supplier を除く)
// - 設定が共通設定そのものであること、別の名前の設定ファイルや Stryker の無効化のコメントがないこと
// - 変異させるファイルに実行されるコードがなければ(雛形の `export {}` だけなど)、Stryker を実行せずにスキップする
// - それ以外は stryker run を実行する。テストのないコードは Stryker が失敗させる(allowEmpty: false)
// - 実行後、無視されたミュータント(Ignored)が1件でもあれば失敗させる(スコアの計算から外れるため)

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { formatViolations, type Violation } from '../checks/files.ts';
import {
  checkConfigs,
  CONFIG_FILE,
  hasMutableCode,
  ignoredMutants,
  inspectPackage,
  packagesWithConfig,
} from './packages.ts';

const root = resolve(import.meta.dirname, '../../../..');
const dirs = process.argv.slice(2);
const failed: string[] = [];

const fail = (title: string, violations: readonly Violation[]): void => {
  failed.push(title);
  process.stderr.write(`${formatViolations(title, violations)}\n`);
};

if (dirs.length === 0) {
  const missing = checkConfigs(root);
  if (missing.length > 0) fail('ミューテーションテストの設定(ADR-0019)', missing);
}

for (const dir of dirs.length > 0 ? dirs : packagesWithConfig(root)) {
  const violations = await inspectPackage(root, dir);
  if (violations.length > 0) {
    fail(`${dir}: ミューテーションテストの設定(ADR-0019)`, violations);
    continue;
  }
  if (!(await hasMutableCode(root, dir))) {
    process.stdout.write(`- ${dir}: 変異させるコードがないため、スキップします\n`);
    continue;
  }

  process.stdout.write(`▶ ${dir}: stryker run ${CONFIG_FILE}\n`);
  // 設定ファイルを明示する(Stryker が別の名前の設定ファイルを優先して読まないように)
  const result = spawnSync(join(root, 'node_modules/.bin/stryker'), ['run', CONFIG_FILE], {
    cwd: join(root, dir),
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    fail(dir, [{ file: dir, message: `ミューテーションテストが失敗しました(終了コード ${String(result.status)})` }]);
    continue;
  }

  const reportFile = join(root, dir, 'reports/mutation/mutation.json');
  if (!existsSync(reportFile)) {
    fail(dir, [{ file: dir, message: 'ミューテーションテストのレポートがありません' }]);
    continue;
  }
  const ignored = ignoredMutants(JSON.parse(readFileSync(reportFile, 'utf8')) as Parameters<typeof ignoredMutants>[0]);
  if (ignored > 0) {
    fail(dir, [{ file: dir, message: `無視されたミュータントが ${String(ignored)} 件あります(スコアの計算から外れるため認めません)` }]);
  }
}

process.exitCode = failed.length === 0 ? 0 : 1;
