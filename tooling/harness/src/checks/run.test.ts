// 検査の CLI(run.ts)の自己テスト。違反があれば終了コード 1 で終わり、CI を失敗させること。

import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

import { describe, expect, test } from 'vitest';

import { materialize } from './fixture.ts';

const run = (...args: string[]) => {
  const r = spawnSync(process.execPath, [resolve(import.meta.dirname, 'run.ts'), ...args], { encoding: 'utf8' });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
};

const git = (cwd: string, ...args: string[]): void => {
  const r = spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', ...args], {
    cwd,
    encoding: 'utf8',
  });
  if (r.status !== 0) throw new Error(r.stderr);
};

describe('run.ts repo', () => {
  test('違反がなければ終了コード 0', () => {
    const r = run('repo', '--root', materialize({ 'README.md': '# x\n' }));
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('✓ Route Handler と Server Actions');
  });

  test.each([
    ['Route Handler', { 'apps/web/src/app/x/route.ts': 'export const GET = 1;\n' }, 'Route Handler と Server Actions'],
    ['要件トレーサビリティ', { 'tests/acceptance/a.test.ts': "test('REQ-X-001: a', () => {});\n" }, '要件トレーサビリティ'],
    ['Grilling 記録', { 'openspec/changes/x/proposal.md': '# Proposal\n' }, 'Grilling 記録'],
  ])('違反(%s)があれば終了コード 1 で、違反を出力する', (_, fixture, title) => {
    const r = run('repo', '--root', materialize(fixture));
    expect(r.status).toBe(1);
    expect(r.stderr).toContain(`✗ ${title}`);
  });
});

describe('run.ts pr-separation', () => {
  const repoWith = (changed: Record<string, string>): string => {
    const repo = materialize({ 'README.md': '# x\n' });
    git(repo, 'add', '-A');
    git(repo, 'commit', '-q', '-m', 'base');
    git(repo, 'switch', '-q', '-c', 'feature');
    for (const [path, content] of Object.entries(changed)) {
      mkdirSync(dirname(join(repo, path)), { recursive: true });
      writeFileSync(join(repo, path), content);
    }
    git(repo, 'add', '-A');
    git(repo, 'commit', '-q', '-m', 'feature');
    return repo;
  };

  test('分離されていれば終了コード 0', () => {
    const repo = repoWith({ 'packages/shared/src/a.ts': 'export const a = 1;\n' });
    expect(run('pr-separation', '--root', repo, '--base', 'main', '--head', 'feature').status).toBe(0);
  });

  test('実装と受け入れテストを同じ PR で変更すると終了コード 1', () => {
    const repo = repoWith({ 'packages/shared/src/a.ts': 'x\n', 'tests/acceptance/a.test.ts': 'x\n' });
    const r = run('pr-separation', '--root', repo, '--base', 'main', '--head', 'feature');
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('tests/acceptance/a.test.ts');
  });

  test('依存(node_modules)のない場所に置いたスクリプトからでも実行できる(CI は base 側の worktree から実行する)', () => {
    const repo = repoWith({ 'packages/shared/src/a.ts': 'x\n', 'tests/acceptance/a.test.ts': 'x\n' });
    const copy = mkdtempSync(join(tmpdir(), 'ota-harness-copy-'));
    cpSync(resolve(import.meta.dirname, '..'), join(copy, 'tooling/harness/src'), { recursive: true });
    const r = spawnSync(
      process.execPath,
      [join(copy, 'tooling/harness/src/checks/run.ts'), 'pr-separation', '--root', repo, '--base', 'main', '--head', 'feature'],
      { encoding: 'utf8' },
    );
    expect(r.stderr).toContain('tests/acceptance/a.test.ts');
    expect(r.status).toBe(1);
  });

  test.each([
    ['base がない', ['--head', 'HEAD']],
    ['base が空', ['--base', '', '--head', 'HEAD']],
    ['head が空', ['--base', 'main', '--head', '']],
  ])('%s場合は終了コード 1(検査を素通りさせない)', (_, args) => {
    expect(run('pr-separation', ...args).status).toBe(1);
  });

  test('コマンドがなければ終了コード 1', () => {
    expect(run().status).toBe(1);
  });
});
