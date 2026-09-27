// ミューテーションテストの実行(ADR-0019)。違反や失敗があれば終了コード 1 で終わる。
//   node tooling/harness/src/mutation/run.ts            すべてのパッケージ(設定ファイルの有無も検査する)
//   node tooling/harness/src/mutation/run.ts <dir>...   指定したパッケージのみ(プロジェクトルート基準のパス)
//
// - apps/ と packages/ の各パッケージに stryker.config.mjs があること(テスト用の偽物の apps/fake-supplier を除く)
// - 変異させるファイルに実行されるコードがなければ(雛形の `export {}` だけなど)、Stryker を実行せずにスキップする
// - それ以外は stryker run を実行する。テストのないコードは Stryker が失敗させる(allowEmpty: false)

import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';

import { formatViolations } from '../checks/files.ts';
import { checkConfigs, hasMutableCode, packagesWithConfig } from './packages.ts';

const root = resolve(import.meta.dirname, '../../../..');
const dirs = process.argv.slice(2);
let ok = true;

if (dirs.length === 0) {
  const missing = checkConfigs(root);
  if (missing.length > 0) {
    ok = false;
    process.stderr.write(`${formatViolations('ミューテーションテストの設定(ADR-0019)', missing)}\n`);
  }
}

for (const dir of dirs.length > 0 ? dirs : packagesWithConfig(root)) {
  if (!(await hasMutableCode(root, dir))) {
    process.stdout.write(`- ${dir}: 変異させるコードがないため、スキップします\n`);
    continue;
  }
  process.stdout.write(`▶ ${dir}: stryker run\n`);
  const result = spawnSync(join(root, 'node_modules/.bin/stryker'), ['run'], { cwd: join(root, dir), stdio: 'inherit' });
  if (result.status !== 0) {
    ok = false;
    process.stderr.write(`✗ ${dir}: ミューテーションテストが失敗しました(終了コード ${String(result.status)})\n`);
  }
}

process.exitCode = ok ? 0 : 1;
