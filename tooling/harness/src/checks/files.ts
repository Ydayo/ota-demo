// 検査スクリプトの共通処理。

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/** 検査で見つかった違反。file はプロジェクトルートからの相対パス(区切りは /) */
export type Violation = { readonly file: string; readonly message: string };

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  '.turbo',
  'dist',
  'coverage',
  'reports',
  '.stryker-tmp',
  'test-results',
  'playwright-report',
]);

/** root/dir 以下のファイルを、root からの相対パス(区切りは /)で列挙する。dir がなければ空 */
export const listFiles = (root: string, dir: string): string[] => {
  const start = join(root, dir);
  if (!existsSync(start)) return [];
  const files: string[] = [];
  const walk = (abs: string): void => {
    for (const entry of readdirSync(abs, { withFileTypes: true })) {
      const child = join(abs, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) walk(child);
      } else if (entry.isFile()) {
        files.push(relative(root, child).split(sep).join('/'));
      }
    }
  };
  walk(start);
  return files.sort();
};

export const readText = (root: string, file: string): string => readFileSync(join(root, file), 'utf8');

export const formatViolations = (title: string, violations: readonly Violation[]): string =>
  [`✗ ${title}: ${String(violations.length)} 件の違反`, ...violations.map((v) => `  - ${v.file}: ${v.message}`)].join(
    '\n',
  );
