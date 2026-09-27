// PR の分離の検査(ADR-0016)の自己テスト。

import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { describe, expect, test } from 'vitest';

import { materialize } from './fixture.ts';
import { changedFilesBetween, checkPrSeparation, kindOf, type ChangeKind } from './pr-separation.ts';

const files = (changed: readonly string[]): string[] => checkPrSeparation(changed).map((v) => v.file);

describe('変更の分類', () => {
  test.each<[string, ChangeKind]>([
    ['packages/modules/booking/domain/booking.ts', 'implementation'],
    ['apps/web/src/app/page.tsx', 'implementation'],
    ['package.json', 'implementation'],
    ['pnpm-lock.yaml', 'implementation'],
    ['tests/e2e/smoke.spec.ts', 'implementation'],
    ['openspec/specs/booking/spec.md', 'spec'],
    ['openspec/changes/add-search/proposal.md', 'spec'],
    ['packages/modules/booking/CONTEXT.md', 'spec'],
    ['CONTEXT-MAP.md', 'spec'],
    ['docs/adr/0017-x.md', 'spec'],
    ['docs/constitution.md', 'spec'],
    ['tests/acceptance/booking.test.ts', 'acceptance-test'],
    ['.github/workflows/ci.yml', 'harness'],
    ['tooling/harness/src/checks/run.ts', 'harness'],
    ['openspec/config.yaml', 'harness'],
    ['CLAUDE.md', 'harness'],
    ['packages/shared/stryker.config.mjs', 'harness'],
  ])('%s → %s', (path, kind) => {
    expect(kindOf(path)).toBe(kind);
  });
});

describe('PR の分離の検査(ADR-0016)', () => {
  test.each([
    ['実装のみ', ['packages/shared/src/a.ts', 'package.json']],
    ['仕様のみ', ['openspec/changes/x/proposal.md', 'docs/adr/0017-x.md']],
    ['受け入れテストのみ', ['tests/acceptance/a.test.ts']],
    ['仕様と受け入れテスト', ['openspec/changes/x/proposal.md', 'tests/acceptance/a.test.ts']],
    ['ハーネスと実装', ['.github/workflows/ci.yml', 'package.json']],
    ['ハーネスと仕様', ['.github/workflows/ci.yml', 'docs/adr/0017-x.md']],
    ['変更なし', []],
  ])('違反しない: %s', (_, changed) => {
    expect(files(changed)).toEqual([]);
  });

  test('実装と受け入れテストを同じ PR で変更すると、受け入れテストを違反として報告する', () => {
    expect(files(['packages/shared/src/a.ts', 'tests/acceptance/a.test.ts'])).toEqual(['tests/acceptance/a.test.ts']);
  });

  test('実装と仕様・ADR・用語集・憲法を同じ PR で変更すると、それぞれを違反として報告する', () => {
    const guarded = [
      'openspec/specs/booking/spec.md',
      'docs/adr/0017-x.md',
      'packages/modules/booking/CONTEXT.md',
      'docs/constitution.md',
    ];
    expect(files(['apps/web/src/app/page.tsx', '.github/workflows/ci.yml', ...guarded])).toEqual(guarded);
  });

  test('違反のメッセージに、同じ PR の実装ファイルを含める', () => {
    const [violation] = checkPrSeparation(['package.json', 'tests/acceptance/a.test.ts']);
    expect(violation?.message).toContain('package.json');
  });
});

describe('変更されたファイルの取得', () => {
  const git = (cwd: string, ...args: string[]): void => {
    const r = spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', ...args], {
      cwd,
      encoding: 'utf8',
    });
    if (r.status !== 0) throw new Error(r.stderr);
  };
  const commit = (repo: string, files: Record<string, string>, message: string): void => {
    for (const [path, content] of Object.entries(files)) writeFileSync(join(repo, path), content);
    git(repo, 'add', '-A');
    git(repo, 'commit', '-q', '-m', message);
  };

  test('merge-base から head までの変更を、削除・リネーム前のパスと日本語のパスを含めて返す', () => {
    const repo = materialize({ 'a.ts': 'a\n', 'old.ts': 'o\n', 'gone.ts': 'g\n' });
    commit(repo, {}, 'base');
    git(repo, 'switch', '-q', '-c', 'feature');
    git(repo, 'mv', 'old.ts', 'new.ts');
    git(repo, 'rm', '-q', 'gone.ts');
    commit(repo, { '仕様.md': 'x\n' }, 'feature');
    // base 側だけの変更は含めない
    git(repo, 'switch', '-q', 'main');
    commit(repo, { 'main-only.ts': 'm\n' }, 'main');

    expect(changedFilesBetween(repo, 'main', 'feature').sort()).toEqual(['gone.ts', 'new.ts', 'old.ts', '仕様.md']);
  });

  test('存在しない ref ではエラーにする(検査を素通りさせない)', () => {
    expect(() => changedFilesBetween(resolve(import.meta.dirname, '../../../..'), 'no-such-ref', 'HEAD')).toThrow(
      /git diff に失敗しました/,
    );
  });
});
