// ミューテーションテストの対象のパッケージと、変異させるファイル(ADR-0019)。

import { existsSync } from 'node:fs';
import { join, matchesGlob, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

import { hasExecutableCode, parse } from '../checks/ast.ts';
import { listFiles, readText, type Violation } from '../checks/files.ts';

export const CONFIG_FILE = 'stryker.config.mjs';

/** ミューテーションテストの対象外のパッケージ(テスト用の偽物) */
export const EXCLUDED_PACKAGES = new Set(['apps/fake-supplier']);

/** stryker.config.mjs が必要なパッケージ(pnpm-workspace.yaml のうち apps/ と packages/ の下) */
const PACKAGE_JSON = /^(apps\/[^/]+|packages\/(?:shared|platform)|packages\/(?:modules|products)\/[^/]+)\/package\.json$/;

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

/** 変異させるファイルに、実行されるコードがあるか */
export const hasMutableCode = async (root: string, dir: string): Promise<boolean> => {
  const configUrl = pathToFileURL(join(root, dir, CONFIG_FILE)).href;
  const config = ((await import(configUrl)) as { default: { mutate: readonly string[] } }).default;
  const files = listFiles(root, dir).map((f) => relative(dir, f));
  return mutatedFiles(files, config.mutate).some((f) => hasExecutableCode(parse(f, readText(root, join(dir, f)))));
};
