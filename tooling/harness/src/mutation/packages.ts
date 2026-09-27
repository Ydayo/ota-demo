// ミューテーションテストの対象のパッケージと、その設定の検査(ADR-0019)。

import { existsSync } from 'node:fs';
import { basename, join, matchesGlob, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

import { hasExecutableCode, parse } from '../checks/ast.ts';
import { listFiles, readText, type Violation } from '../checks/files.ts';
import { ALWAYS_EXCLUDED, strykerConfig, type PackageKind } from './stryker.ts';

export const CONFIG_FILE = 'stryker.config.mjs';

/** ミューテーションテストの対象外のパッケージ(テスト用の偽物) */
export const EXCLUDED_PACKAGES = new Set(['apps/fake-supplier']);

/** stryker.config.mjs が必要なパッケージ(pnpm-workspace.yaml のうち apps/ と packages/ の下) */
const PACKAGE_JSON = /^(apps\/[^/]+|packages\/(?:modules|products)\/[^/]+|packages\/[^/]+)\/package\.json$/;

/** Stryker が読み込む設定ファイルの名前(stryker.conf.json などが stryker.config.mjs より優先される) */
const ANY_STRYKER_CONFIG = /^\.?stryker\.(?:conf|config)\.[^/]+$/;

/** 業務ロジックを含むパッケージ(閾値 domain)。それ以外は other */
export const expectedKind = (dir: string): PackageKind =>
  /^packages\/(?:modules|products)\/[^/]+$/.test(dir) || dir === 'packages/shared' || !/^(apps|packages)\//.test(dir)
    ? 'domain'
    : 'other';

const workspaceFiles = (root: string): string[] => [...listFiles(root, 'apps'), ...listFiles(root, 'packages')];

/** stryker.config.mjs のないパッケージ */
export const checkConfigs = (root: string): Violation[] =>
  workspaceFiles(root)
    .flatMap((file) => {
      const dir = PACKAGE_JSON.exec(file)?.[1];
      return dir === undefined || EXCLUDED_PACKAGES.has(dir) ? [] : [dir];
    })
    .filter((dir) => !existsSync(join(root, dir, CONFIG_FILE)))
    .map((dir) => ({
      file: `${dir}/${CONFIG_FILE}`,
      message:
        'ミューテーションテストの設定がありません(tooling/harness/src/mutation/stryker.ts の strykerConfig を使って作成してください)',
    }));

/** stryker.config.mjs のあるパッケージのディレクトリ */
export const packagesWithConfig = (root: string): string[] =>
  workspaceFiles(root)
    .filter((f) => f.endsWith(`/${CONFIG_FILE}`))
    .map((f) => f.slice(0, -CONFIG_FILE.length - 1));

/** 設定の mutate(! で始まるものは除外)に一致するファイル。パスはパッケージのディレクトリ基準 */
export const mutatedFiles = (files: readonly string[], mutate: readonly string[]): string[] => {
  const include = mutate.filter((p) => !p.startsWith('!'));
  const exclude = mutate.filter((p) => p.startsWith('!')).map((p) => p.slice(1));
  return files.filter((f) => include.some((p) => matchesGlob(f, p)) && !exclude.some((p) => matchesGlob(f, p)));
};

type LoadedConfig = { readonly mutate: readonly string[] };

const loadConfig = async (root: string, dir: string): Promise<LoadedConfig> => {
  const url = pathToFileURL(join(root, dir, CONFIG_FILE)).href;
  return ((await import(url)) as { default: LoadedConfig }).default;
};

/** 設定の mutate から、パッケージごとの除外(exclude)を取り出す */
const excludesOf = (config: LoadedConfig): string[] =>
  config.mutate
    .slice(1)
    .map((p) => p.replace(/^!/, ''))
    .filter((p) => !(ALWAYS_EXCLUDED as readonly string[]).includes(p));

/**
 * パッケージの設定と変異させるファイルの検査。
 * - Stryker が優先して読む別の名前の設定ファイル(stryker.conf.json など)がない
 * - 設定が strykerConfig({ kind: パスから決まる種類, exclude }) と完全に一致する(閾値や範囲の書き換えを防ぐ)
 * - 変異させるファイルに Stryker の無効化のコメント(// Stryker disable)がない
 */
export const inspectPackage = async (root: string, dir: string): Promise<Violation[]> => {
  const violations: Violation[] = [];
  const files = listFiles(root, dir).map((f) => relative(dir, f));

  for (const f of files) {
    const name = basename(f);
    if (ANY_STRYKER_CONFIG.test(name) && f !== CONFIG_FILE) {
      violations.push({
        file: join(dir, f),
        message: `${CONFIG_FILE} 以外の Stryker の設定ファイルは置けません(Stryker が優先して読み込むため)`,
      });
    }
  }

  const config = await loadConfig(root, dir);
  const kind = expectedKind(dir);
  if (!isDeepStrictEqual(config, strykerConfig({ kind, exclude: excludesOf(config) }))) {
    violations.push({
      file: join(dir, CONFIG_FILE),
      message: `設定は strykerConfig({ kind: '${kind}', exclude }) の戻り値そのものにしてください(閾値の種類はパスで決まります。ADR-0019)`,
    });
  }

  for (const f of mutatedFiles(files, config.mutate)) {
    if (/Stryker\s+(?:disable|restore)\b/.test(readText(root, join(dir, f)))) {
      violations.push({
        file: join(dir, f),
        message: 'Stryker の無効化のコメント(// Stryker disable)は使えません(憲法 第3条)',
      });
    }
  }
  return violations;
};

/** 変異させるファイルに、実行されるコードがあるか */
export const hasMutableCode = async (root: string, dir: string): Promise<boolean> => {
  const config = await loadConfig(root, dir);
  const files = listFiles(root, dir).map((f) => relative(dir, f));
  return mutatedFiles(files, config.mutate).some((f) => hasExecutableCode(parse(f, readText(root, join(dir, f)))));
};

type MutationReport = { readonly files: Record<string, { readonly mutants: readonly { readonly status: string }[] }> };

/** Stryker の JSON レポートで、無視されたミュータント(Ignored)の数 */
export const ignoredMutants = (report: MutationReport): number =>
  Object.values(report.files).reduce((n, file) => n + file.mutants.filter((m) => m.status === 'Ignored').length, 0);
