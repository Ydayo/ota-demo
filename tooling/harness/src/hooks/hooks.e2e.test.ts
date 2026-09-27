// hook のスクリプトを実際に起動し、Claude Code と同じ形式の入力に対する終了コードと出力を確かめる。

import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

import { describe, expect, test } from 'vitest';

const root = resolve(import.meta.dirname, '../../../..');

const runHook = (script: string, input: unknown, env: Record<string, string> = {}) => {
  const result = spawnSync(process.execPath, [resolve(import.meta.dirname, script)], {
    input: JSON.stringify(input),
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PROJECT_DIR: root, OTA_ROLE: '', ...env },
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
};

const edit = (file: string) => ({ tool_name: 'Edit', tool_input: { file_path: `${root}/${file}` } });

describe('PreToolUse hook', () => {
  test('implementer は受け入れテストを編集できない(exit 2 と理由)', () => {
    const r = runHook('pre-tool-use.ts', edit('tests/acceptance/a.test.ts'));
    expect(r.status).toBe(2);
    expect(r.stderr).toContain('docs/adr/0006');
  });

  test('test-author は受け入れテストを編集できる', () => {
    expect(runHook('pre-tool-use.ts', edit('tests/acceptance/a.test.ts'), { OTA_ROLE: 'test-author' }).status).toBe(0);
  });

  test('implementer は実装ファイルを編集できる', () => {
    expect(runHook('pre-tool-use.ts', edit('packages/modules/booking/domain/a.ts')).status).toBe(0);
  });

  test('不正な OTA_ROLE ではすべてブロックする', () => {
    expect(runHook('pre-tool-use.ts', edit('README.md'), { OTA_ROLE: 'admin' }).status).toBe(2);
  });

  test('Bash の --no-verify をブロックする', () => {
    const r = runHook('pre-tool-use.ts', { tool_name: 'Bash', tool_input: { command: 'git commit --no-verify' } });
    expect(r.status).toBe(2);
  });

  test('Read などの読み取りは対象外', () => {
    expect(runHook('pre-tool-use.ts', { tool_name: 'Read', tool_input: { file_path: `${root}/docs/constitution.md` } }).status).toBe(0);
  });
});

describe('UserPromptSubmit hook', () => {
  test('/opsx:propose では Grilling を促す文脈を追加する', () => {
    const r = runHook('user-prompt-submit.ts', { prompt: '/opsx:propose ホテル検索' });
    expect(r.status).toBe(0);
    const out = JSON.parse(r.stdout) as { hookSpecificOutput: { hookEventName: string; additionalContext: string } };
    expect(out.hookSpecificOutput.hookEventName).toBe('UserPromptSubmit');
    expect(out.hookSpecificOutput.additionalContext).toContain('grilling');
  });

  test('それ以外のプロンプトでは何も出力しない', () => {
    const r = runHook('user-prompt-submit.ts', { prompt: 'テストを直して' });
    expect(r.status).toBe(0);
    expect(r.stdout).toBe('');
  });
});
