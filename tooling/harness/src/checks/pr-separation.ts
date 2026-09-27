// PR の分離の検査(ADR-0016)。
// 実装を変更する PR は、仕様・用語集・ADR(と憲法)や受け入れテストを変更してはならない。
// ハーネスの変更は、実装とも仕様とも同じ PR に含めてよい(CODEOWNERS で人間のレビューを必ず通る)。

import { spawnSync } from 'node:child_process';

import { classifyRelative } from '../hooks/protected-paths.ts';
import type { Violation } from './files.ts';

export type ChangeKind = 'implementation' | 'spec' | 'acceptance-test' | 'harness';

export const kindOf = (path: string): ChangeKind => {
  const area = classifyRelative(path);
  switch (area) {
    case undefined:
      return 'implementation';
    case 'spec':
    case 'constitution':
      return 'spec';
    case 'acceptance-test':
      return 'acceptance-test';
    case 'harness':
    case 'user-claude-config':
      return 'harness';
  }
};

const LABEL: Record<'spec' | 'acceptance-test', string> = {
  spec: '仕様・用語集・ADR・憲法',
  'acceptance-test': '受け入れテスト',
};

export const checkPrSeparation = (changedFiles: readonly string[]): Violation[] => {
  const implementation = changedFiles.filter((f) => kindOf(f) === 'implementation');
  if (implementation.length === 0) return [];
  const example = implementation.slice(0, 3).join(', ');
  return changedFiles.flatMap((file) => {
    const kind = kindOf(file);
    if (kind !== 'spec' && kind !== 'acceptance-test') return [];
    return [
      {
        file,
        message: `${LABEL[kind]}を、実装(${String(implementation.length)} ファイル。例: ${example})と同じ PR で変更しています。PR を分けてください(ADR-0016)`,
      },
    ];
  });
};

/** base と head の merge-base から head までに変更されたファイル(削除とリネーム前のパスを含む) */
export const changedFilesBetween = (root: string, base: string, head: string): string[] => {
  // -z: 日本語などを含むパスを引用符でエスケープさせずに、NUL 区切りで受け取る
  const result = spawnSync('git', ['diff', '--name-only', '--no-renames', '-z', `${base}...${head}`], {
    cwd: root,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error(`git diff に失敗しました(base: ${base}, head: ${head}): ${result.stderr.trim()}`);
  }
  return result.stdout.split('\0').filter(Boolean);
};
