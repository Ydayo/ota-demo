import { describe, expect, test } from 'vitest';

import { checkBash } from './bash-guard.ts';

const ctx = { projectDir: '/repo', homeDir: '/home/u' };
const decide = (command: string) => checkBash(command, ctx).decision;

describe('Bash の検査(ADR-0016、憲法 第4条)', () => {
  test.each([
    'git commit --no-verify -m x',
    'git push --force origin main',
    'git push -f',
    'git push --force-with-lease',
    'claude -p "hello"',
    'OTA_ROLE=harness claude',
    '/usr/local/bin/claude --help',
    'gh auth login',
    'echo x > ~/.claude/settings.json',
  ])('拒否: %s', (command) => {
    expect(decide(command)).toBe('deny');
  });

  test.each([
    'echo x > openspec/specs/a.md',
    'echo x >> tests/acceptance/a.test.ts',
    'sed -i "" s/a/b/ tests/acceptance/a.test.ts',
    'rm docs/adr/0001-x.md',
    'cp /tmp/x .claude/settings.json',
    'tee CLAUDE.md < x',
    'git checkout -- tests/acceptance/a.test.ts',
    "python3 -c \"open('eslint.config.js','w')\"",
    'cd /repo && echo x > /repo/.github/workflows/ci.yml',
    'echo x > docs/constitution.md',
    'mv a.md docs/constitution.md',
  ])('保護対象への書き込みはローカルでは止めない(ADR-0017): %s', (command) => {
    expect(decide(command)).toBe('allow');
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
    expect(decide(command)).toBe('allow');
  });

  test('拒否の対象が含まれていれば、保護対象への書き込みと一緒でも拒否する', () => {
    expect(decide('cp x tests/acceptance/a.test.ts ~/.claude/settings.json')).toBe('deny');
  });
});
