// CODEOWNERS が、hook の保護対象(protected-paths.ts)と一致していることの検査。
// CODEOWNERS は保護対象の最終防衛線(ADR-0006、ADR-0016)なので、分類とのずれを許さない。

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, test } from 'vitest';

import { classifyRelative } from '../hooks/protected-paths.ts';

const root = resolve(import.meta.dirname, '../../../..');
const OWNER = '@Ydayo';

type Rule = { readonly pattern: RegExp; readonly owners: readonly string[] };

/** CODEOWNERS のパターン(gitignore の書式)を正規表現にする。このリポジトリで使う書式だけに対応する */
const toRegExp = (glob: string): RegExp => {
  const directory = glob.endsWith('/');
  const body = directory ? glob.slice(0, -1) : glob;
  // 先頭または途中に / があればルート基準、なければ任意の階層のファイル名・ディレクトリ名に一致する
  const anchored = body.includes('/');
  const source = body
    .replace(/^\//, '')
    .split(/(\*\*\/|\*)/)
    .map((part) => {
      if (part === '**/') return '(?:.*/)?';
      if (part === '*') return '[^/]*';
      return part.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('');
  return new RegExp(`${anchored ? '^' : '(?:^|/)'}${source}${directory ? '/' : '(?:$|/)'}`);
};

const rules: Rule[] = readFileSync(resolve(root, '.github/CODEOWNERS'), 'utf8')
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => line !== '' && !line.startsWith('#'))
  .map((line) => {
    const [glob = '', ...owners] = line.split(/\s+/);
    return { pattern: toRegExp(glob), owners };
  });

/** 最後に一致したルールの所有者(GitHub の CODEOWNERS と同じく、後のルールが優先) */
const ownersOf = (path: string): readonly string[] =>
  rules.findLast((rule) => rule.pattern.test(path))?.owners ?? [];

const trackedFiles = (): string[] =>
  spawnSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8' })
    .stdout.split('\0')
    .filter(Boolean);

describe('CODEOWNERS と保護対象の一致', () => {
  test.each([
    'openspec/specs/booking/spec.md',
    'openspec/changes/add-search/proposal.md',
    'openspec/config.yaml',
    'openspec/schemas/ota-flow/schema.yaml',
    'CONTEXT-MAP.md',
    'packages/modules/booking/CONTEXT.md',
    'docs/adr/0017-x.md',
    'packages/modules/booking/docs/adr/0001-x.md',
    'docs/constitution.md',
    'tests/acceptance/booking/search.test.ts',
    '.claude/settings.json',
    '.github/workflows/ci.yml',
    'tooling/harness/src/checks/run.ts',
    'CLAUDE.md',
    'apps/web/CLAUDE.md',
    'packages/modules/booking/CLAUDE.local.md',
    'eslint.config.js',
    '.dependency-cruiser.cjs',
    'vitest.config.ts',
    'tsconfig.base.json',
    'turbo.json',
    'skills-lock.json',
    'packages/modules/booking/stryker.config.mjs',
  ])('保護対象は %s の所有者に含まれる', (path) => {
    expect(classifyRelative(path)).toBeDefined();
    expect(ownersOf(path)).toContain(OWNER);
  });

  test.each([
    'packages/modules/booking/domain/booking.ts',
    'apps/web/src/app/page.tsx',
    'package.json',
    'tests/e2e/smoke.spec.ts',
    'docs/adr-notes.md',
    'packages/shared/eslint.config.js',
  ])('実装 %s には所有者がない', (path) => {
    expect(classifyRelative(path)).toBeUndefined();
    expect(ownersOf(path)).toEqual([]);
  });

  test('リポジトリの全ファイルで、保護対象であることと所有者がいることが一致する', () => {
    const mismatches = trackedFiles().filter(
      (path) => (classifyRelative(path) !== undefined) !== ownersOf(path).includes(OWNER),
    );
    expect(mismatches).toEqual([]);
  });
});
