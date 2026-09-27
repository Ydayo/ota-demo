// ミューテーションテストのゲート(ADR-0019)の自己テスト。
// 閾値を下回るパッケージ、テストのないコードが失敗し、設定の漏れを検出できることを確かめる。

import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

import { describe, expect, test } from 'vitest';

import { hasExecutableCode, parse } from '../checks/ast.ts';
import { materialize } from '../checks/fixture.ts';
import { checkConfigs, mutatedFiles } from './packages.ts';
import { THRESHOLDS } from './stryker.ts';

const root = resolve(import.meta.dirname, '../../../..');

const run = (fixture: string) =>
  spawnSync(process.execPath, [resolve(import.meta.dirname, 'run.ts'), `tooling/harness/fixtures/mutation/${fixture}`], {
    cwd: root,
    encoding: 'utf8',
  });

describe('閾値', () => {
  test('業務ロジックを含むパッケージは break 80、それ以外は break 60(人間の決定)', () => {
    expect(THRESHOLDS.domain.break).toBe(80);
    expect(THRESHOLDS.other.break).toBe(60);
  });
});

describe('ミューテーションテストの実行(Stryker を実際に動かす)', () => {
  test('テストが十分なら成功する', () => {
    expect(run('strong').status).toBe(0);
  });

  test('スコアが閾値を下回れば失敗する', () => {
    const r = run('weak');
    expect(r.stdout + r.stderr).toMatch(/under breaking threshold 80/);
    expect(r.status).toBe(1);
  });

  test('テストのないコードは失敗する(テストが0件でも素通りさせない)', () => {
    expect(run('untested').status).toBe(1);
  });

  test('変異させるコードがなければ、Stryker を実行せずに成功する', () => {
    const r = run('empty');
    expect(r.stdout).toContain('スキップします');
    expect(r.status).toBe(0);
  });
});

describe('設定ファイルの検査', () => {
  const pkg = (dir: string) => ({ [`${dir}/package.json`]: '{}' });

  test('パッケージに stryker.config.mjs がなければ検出する(apps/fake-supplier と tooling は対象外)', () => {
    const repo = materialize({
      ...pkg('apps/web'),
      'apps/web/stryker.config.mjs': '',
      ...pkg('apps/fake-supplier'),
      ...pkg('packages/shared'),
      ...pkg('packages/platform'),
      ...pkg('packages/modules/booking'),
      ...pkg('packages/products/hotel'),
      ...pkg('tooling/harness'),
    });
    expect(checkConfigs(repo).map((v) => v.file)).toEqual([
      'packages/modules/booking/stryker.config.mjs',
      'packages/platform/stryker.config.mjs',
      'packages/products/hotel/stryker.config.mjs',
      'packages/shared/stryker.config.mjs',
    ]);
  });

  test('このリポジトリのすべてのパッケージに設定がある', () => {
    expect(checkConfigs(root)).toEqual([]);
  });
});

describe('変異させるファイル', () => {
  test('mutate の glob と、! で始まる除外を適用する', () => {
    expect(
      mutatedFiles(
        ['index.ts', 'src/a.ts', 'src/a.test.ts', 'src/server/container.ts', 'README.md'],
        ['index.ts', 'src/**/*.ts', '!**/*.test.ts', '!src/server/container.ts'],
      ),
    ).toEqual(['index.ts', 'src/a.ts']);
  });

  test.each([
    ['export {} のみ', 'export {};\n', false],
    ['再エクスポートと型', "export type { A } from './a';\nexport { b } from './b';\ntype C = string;\ninterface D { x: C }\n", false],
    ['declare', 'declare const x: number;\n', false],
    ['関数', 'export const f = () => 1;\n', true],
    ['enum', 'export enum E { A }\n', true],
    ['式文', "console.log('x');\n", true],
  ])('実行されるコードの有無: %s', (_, code, expected) => {
    expect(hasExecutableCode(parse('a.ts', code))).toBe(expected);
  });
});
