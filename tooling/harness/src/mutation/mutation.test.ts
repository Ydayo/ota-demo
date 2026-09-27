// ミューテーションテストのゲート(ADR-0019)の自己テスト。
// 閾値を下回るパッケージ、テストのないコード、ゲートを無効にする書き方が失敗し、設定の漏れや改変を検出できることを確かめる。

import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

import { describe, expect, test } from 'vitest';

import { hasExecutableCode, parse } from '../checks/ast.ts';
import { materialize } from '../checks/fixture.ts';
import { checkConfigs, expectedKind, ignoredMutants, inspectPackage, mutatedFiles } from './packages.ts';
import { ALWAYS_EXCLUDED, MUTATE_ALL, THRESHOLDS } from './stryker.ts';

const root = resolve(import.meta.dirname, '../../../..');
const strykerModule = resolve(import.meta.dirname, 'stryker.ts');

const run = (fixture: string) => {
  const r = spawnSync(
    process.execPath,
    [resolve(import.meta.dirname, 'run.ts'), `tooling/harness/fixtures/mutation/${fixture}`],
    { cwd: root, encoding: 'utf8' },
  );
  return { status: r.status, output: r.stdout + r.stderr };
};

describe('閾値(人間の決定)', () => {
  test('業務ロジックを含むパッケージは break 80、それ以外は break 60', () => {
    expect(THRESHOLDS).toEqual({
      domain: { high: 90, low: 80, break: 80 },
      other: { high: 80, low: 60, break: 60 },
    });
  });

  test.each([
    ['packages/modules/booking', 'domain'],
    ['packages/products/hotel', 'domain'],
    ['packages/shared', 'domain'],
    ['packages/platform', 'other'],
    ['apps/web', 'other'],
  ])('%s の閾値は %s', (dir, kind) => {
    expect(expectedKind(dir)).toBe(kind);
  });
});

describe('ミューテーションテストの実行(Stryker を実際に動かす)', () => {
  test('テストが十分なら成功する', () => {
    expect(run('strong').status).toBe(0);
  });

  test('スコアが閾値を下回れば失敗する', () => {
    const r = run('weak');
    expect(r.output).toMatch(/under breaking threshold 80/);
    expect(r.status).toBe(1);
  });

  test('テストのないコードは失敗する(テストが0件でも素通りさせない)', () => {
    const r = run('untested');
    expect(r.output).toMatch(/No tests were executed/);
    expect(r.status).toBe(1);
  });

  test('Stryker の無効化のコメントがあれば、実行せずに失敗する', () => {
    const r = run('disabled');
    expect(r.output).toContain('Stryker の無効化のコメント');
    expect(r.output).not.toContain('stryker run');
    expect(r.status).toBe(1);
  });

  test('変異させるコードがなければ、Stryker を実行せずに成功する', () => {
    const r = run('empty');
    expect(r.output).toContain('スキップします');
    expect(r.status).toBe(0);
  });
});

describe('設定ファイルの検査', () => {
  const pkg = (dir: string) => ({ [`${dir}/package.json`]: '{}' });
  const config = (body: string) => `import { strykerConfig } from ${JSON.stringify(strykerModule)};\nexport default ${body};\n`;

  test('パッケージに stryker.config.mjs がなければ検出する(apps/fake-supplier と tooling は対象外)', () => {
    const repo = materialize({
      ...pkg('apps/web'),
      'apps/web/stryker.config.mjs': '',
      ...pkg('apps/fake-supplier'),
      ...pkg('packages/shared'),
      ...pkg('packages/platform'),
      ...pkg('packages/new-kernel'),
      ...pkg('packages/modules/booking'),
      ...pkg('packages/products/hotel'),
      ...pkg('tooling/harness'),
    });
    expect(checkConfigs(repo).map((v) => v.file)).toEqual([
      'packages/modules/booking/stryker.config.mjs',
      'packages/new-kernel/stryker.config.mjs',
      'packages/platform/stryker.config.mjs',
      'packages/products/hotel/stryker.config.mjs',
      'packages/shared/stryker.config.mjs',
    ]);
  });

  test('共通設定そのままなら違反はない(除外の指定は認める)', async () => {
    const repo = materialize({
      'packages/modules/booking/stryker.config.mjs': config("strykerConfig({ kind: 'domain' })"),
      'apps/web/stryker.config.mjs': config("strykerConfig({ kind: 'other', exclude: ['src/app/**'] })"),
    });
    expect(await inspectPackage(repo, 'packages/modules/booking')).toEqual([]);
    expect(await inspectPackage(repo, 'apps/web')).toEqual([]);
  });

  test.each([
    ['閾値の種類をパスと違うものにする', "strykerConfig({ kind: 'other' })"],
    ['閾値を書き換える', "{ ...strykerConfig({ kind: 'domain' }), thresholds: { high: 90, low: 80, break: null } }"],
    ['テストが0件でも成功させる', "{ ...strykerConfig({ kind: 'domain' }), allowEmpty: true }"],
    ['変異させる範囲を書き換える', "{ ...strykerConfig({ kind: 'domain' }), mutate: ['index.ts'] }"],
    ['無視の設定を足す', "{ ...strykerConfig({ kind: 'domain' }), ignoreStatic: true }"],
  ])('設定の改変を検出する: %s', async (_, body) => {
    const repo = materialize({ 'packages/modules/booking/stryker.config.mjs': config(body) });
    expect((await inspectPackage(repo, 'packages/modules/booking')).map((v) => v.message)).toEqual([
      expect.stringContaining('strykerConfig'),
    ]);
  });

  test.each(['stryker.conf.json', 'stryker.config.json', '.stryker.conf.js', 'src/stryker.conf.mjs'])(
    'Stryker が優先して読む別の名前の設定ファイル %s を検出する',
    async (file) => {
      const repo = materialize({
        'packages/shared/stryker.config.mjs': config("strykerConfig({ kind: 'domain' })"),
        [`packages/shared/${file}`]: '{ "thresholds": { "break": null } }',
      });
      expect((await inspectPackage(repo, 'packages/shared')).map((v) => v.file)).toEqual([`packages/shared/${file}`]);
    },
  );

  test('このリポジトリのすべてのパッケージに設定があり、改変がない', async () => {
    expect(checkConfigs(root)).toEqual([]);
    for (const dir of ['apps/web', 'packages/shared', 'packages/platform', 'packages/modules/booking']) {
      expect(await inspectPackage(root, dir)).toEqual([]);
    }
  });
});

describe('変異させるファイル', () => {
  test('既定ではパッケージのすべてのソースを対象にし、テスト・型宣言・生成物と明示した除外を外す', () => {
    const mutate = [MUTATE_ALL, ...[...ALWAYS_EXCLUDED, 'src/app/**'].map((p) => `!${p}`)];
    expect(
      mutatedFiles(
        ['index.ts', 'lib/x.ts', 'src/a.tsx', 'src/a.test.ts', 'src/app/page.tsx', 'next-env.d.ts', '.next/types/x.ts', 'README.md'],
        mutate,
      ),
    ).toEqual(['index.ts', 'lib/x.ts', 'src/a.tsx']);
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

  test('レポートの無視されたミュータントを数える', () => {
    expect(
      ignoredMutants({
        files: {
          'a.ts': { mutants: [{ status: 'Killed' }, { status: 'Ignored' }] },
          'b.ts': { mutants: [{ status: 'Ignored' }, { status: 'Survived' }] },
        },
      }),
    ).toBe(2);
  });
});
