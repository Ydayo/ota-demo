// Stop hook: 変更したファイルに関連するテストが通るまで、作業を完了扱いにしない。
// (早期フィードバック。最終判定は CI)

import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

import { block, pathContext } from './io.ts';

const { projectDir } = pathContext();

const git = (args: string[]): string[] =>
  spawnSync('git', args, { cwd: projectDir, encoding: 'utf8' })
    .stdout.split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

const changed = [
  ...new Set([...git(['diff', '--name-only', 'HEAD']), ...git(['ls-files', '--others', '--exclude-standard'])]),
].filter((f) => /\.(ts|tsx)$/.test(f) && !f.startsWith('tooling/harness/fixtures/'));

if (changed.length > 0) {
  const result = spawnSync(
    join(projectDir, 'node_modules/.bin/vitest'),
    ['related', '--run', '--project', 'unit', '--project', 'harness', '--passWithNoTests', ...changed],
    { cwd: projectDir, encoding: 'utf8' },
  );
  if (result.status !== 0) {
    const output = `${result.stdout}${result.stderr}`.trim().split('\n').slice(-60).join('\n');
    block(`変更に関連するテストが失敗しています。テストを通してから完了してください。\n\n${output}`);
  }
}
