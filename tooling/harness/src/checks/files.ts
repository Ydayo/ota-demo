// 検査スクリプトの共通処理。

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** 検査で見つかった違反。file はプロジェクトルートからの相対パス(区切りは /) */
export type Violation = { readonly file: string; readonly message: string };

/**
 * root/dir 以下のファイルを、root からの相対パス(区切りは /)で列挙する。
 * Git の追跡対象と、.gitignore で除外されていない未追跡のファイルが対象(node_modules や生成物は含まない)。
 * ディレクトリ名で除外すると、業務上の同名のディレクトリ(reports など)まで検査から漏れるため、.gitignore に従う。
 */
export const listFiles = (root: string, dir: string): string[] => {
  const result = spawnSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', dir], {
    cwd: root,
    encoding: 'utf8',
  });
  if (result.status !== 0) throw new Error(`git ls-files に失敗しました: ${result.stderr.trim()}`);
  return [...new Set(result.stdout.split('\0'))]
    .filter((file) => file !== '' && existsSync(join(root, file)))
    .sort();
};

export const readText = (root: string, file: string): string => readFileSync(join(root, file), 'utf8');

export const formatViolations = (title: string, violations: readonly Violation[]): string =>
  [`✗ ${title}: ${String(violations.length)} 件の違反`, ...violations.map((v) => `  - ${v.file}: ${v.message}`)].join(
    '\n',
  );
