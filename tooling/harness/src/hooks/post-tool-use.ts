// PostToolUse hook: 編集した TypeScript ファイルに lint、そのパッケージに型チェックをかけ、
// 問題があれば Claude に即時に伝える(早期フィードバック。最終判定は CI)。

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

import { block, pathContext, readInput, str } from './io.ts';

const input = await readInput();
const toolInput = (input['tool_input'] ?? {}) as Record<string, unknown>;
const file = str(toolInput['file_path']);
const { projectDir } = pathContext();

const isTarget = (path: string): boolean =>
  /\.(ts|tsx)$/.test(path) &&
  path.startsWith(`${projectDir}/`) &&
  !path.includes('/node_modules/') &&
  !path.includes('/tooling/harness/fixtures/');

const nearestPackage = (path: string): string | undefined => {
  let dir = dirname(path);
  while (dir.startsWith(projectDir) && dir !== projectDir) {
    if (existsSync(join(dir, 'tsconfig.json'))) return dir;
    dir = dirname(dir);
  }
  return undefined;
};

const run = (cmd: string, args: string[], cwd: string): string | undefined => {
  const result = spawnSync(cmd, args, { cwd, encoding: 'utf8' });
  return result.status === 0 ? undefined : `${result.stdout}${result.stderr}`.trim();
};

if (file !== undefined && isTarget(file) && existsSync(file)) {
  const bin = join(projectDir, 'node_modules/.bin');
  const problems: string[] = [];

  const lint = run(join(bin, 'eslint'), ['--max-warnings', '0', relative(projectDir, file)], projectDir);
  if (lint !== undefined) problems.push(`[lint]\n${lint}`);

  const pkg = nearestPackage(file);
  if (pkg !== undefined) {
    const types = run(join(bin, 'tsc'), ['-p', '.'], pkg);
    if (types !== undefined) problems.push(`[typecheck ${relative(projectDir, pkg)}]\n${types}`);
  }

  if (problems.length > 0) block(problems.join('\n\n'));
}
