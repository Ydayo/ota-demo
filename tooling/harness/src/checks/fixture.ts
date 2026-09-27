// 検査の自己テスト用のフィクスチャ。{ 相対パス: 内容 } から一時ディレクトリに Git リポジトリを作る
// (検査はファイルの列挙に git ls-files を使うため)。

import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

export type Fixture = Readonly<Record<string, string>>;

export const materialize = (fixture: Fixture): string => {
  const root = mkdtempSync(join(tmpdir(), 'ota-harness-'));
  for (const [path, content] of Object.entries(fixture)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  const init = spawnSync('git', ['init', '-q', '-b', 'main'], { cwd: root, encoding: 'utf8' });
  if (init.status !== 0) throw new Error(init.stderr);
  return root;
};
