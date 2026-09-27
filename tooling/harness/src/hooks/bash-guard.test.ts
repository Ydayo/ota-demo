import { describe, expect, test } from 'vitest';

import { checkBash } from './bash-guard.ts';

const ctx = { projectDir: '/repo', homeDir: '/home/u' };
const allowed = (command: string, role: Parameters<typeof checkBash>[1] = 'implementer') =>
  checkBash(command, role, ctx).allowed;

describe('Bash の検査(ADR-0006、憲法 第4条)', () => {
  test.each([
    'git commit --no-verify -m x',
    'git push --force origin main',
    'git push -f',
    'git push --force-with-lease',
    'claude -p "hello"',
    'OTA_ROLE=harness claude',
    '/usr/local/bin/claude --help',
    'export OTA_ROLE=spec-author',
    'gh auth login',
    'echo x > openspec/specs/a.md',
    'echo x >> tests/acceptance/a.test.ts',
    'sed -i "" s/a/b/ tests/acceptance/a.test.ts',
    'rm docs/adr/0001-x.md',
    'cp /tmp/x .claude/settings.json',
    'mv a.md docs/constitution.md',
    'tee CLAUDE.md < x',
    'git checkout -- tests/acceptance/a.test.ts',
    "python3 -c \"open('eslint.config.js','w')\"",
    'echo x > ~/.claude/settings.json',
    'cd /repo && echo x > /repo/.github/workflows/ci.yml',
  ])('禁止: %s', (command) => {
    expect(allowed(command)).toBe(false);
  });

  test.each([
    'pnpm check',
    'git status',
    'git push origin feature',
    'cat openspec/specs/a.md',
    'grep -r REQ tests/acceptance',
    'echo x > /tmp/out.txt',
    'rm packages/modules/booking/domain/old.ts',
    'git add -A && git commit -m "docs: update CLAUDE.md index"',
    'ls .claude',
  ])('許可: %s', (command) => {
    expect(allowed(command)).toBe(true);
  });

  test('役割が許す範囲なら書き込める', () => {
    expect(allowed('echo x > openspec/specs/a.md', 'spec-author')).toBe(true);
    expect(allowed('rm tests/acceptance/a.test.ts', 'test-author')).toBe(true);
    expect(allowed('echo x > .github/workflows/ci.yml', 'harness')).toBe(true);
  });

  test('憲法はどの役割でも書き込めない', () => {
    expect(allowed('echo x > docs/constitution.md', 'harness')).toBe(false);
    expect(allowed('echo x > docs/constitution.md', 'spec-author')).toBe(false);
  });
});
