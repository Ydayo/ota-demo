// 検査の自己テスト用のフィクスチャ。{ 相対パス: 内容 } から一時ディレクトリにファイルを作る。

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
  return root;
};
