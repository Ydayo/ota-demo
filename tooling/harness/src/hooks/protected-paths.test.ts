import { describe, expect, test } from 'vitest';

import { classifyPath, DECISION, type ProtectedArea } from './protected-paths.ts';

const ctx = { projectDir: '/repo', homeDir: '/home/u' };

describe('保護対象の分類(ADR-0006)', () => {
  test.each<[string, ProtectedArea | undefined]>([
    ['openspec/specs/booking/spec.md', 'spec'],
    ['openspec/changes/add-search/proposal.md', 'spec'],
    ['openspec/schemas/ota-flow/schema.yaml', 'harness'],
    ['openspec/config.yaml', 'harness'],
    ['skills-lock.json', 'harness'],
    ['CONTEXT-MAP.md', 'spec'],
    ['packages/modules/booking/CONTEXT.md', 'spec'],
    ['docs/adr/0001-x.md', 'spec'],
    ['packages/modules/booking/docs/adr/0001-x.md', 'spec'],
    ['tests/acceptance/booking.test.ts', 'acceptance-test'],
    ['docs/constitution.md', 'constitution'],
    ['CLAUDE.md', 'harness'],
    ['packages/modules/booking/CLAUDE.md', 'harness'],
    ['.claude/settings.json', 'harness'],
    ['.claude/rules/x.md', 'harness'],
    ['.github/workflows/ci.yml', 'harness'],
    ['tooling/harness/src/x.ts', 'harness'],
    ['eslint.config.js', 'harness'],
    ['.dependency-cruiser.cjs', 'harness'],
    ['vitest.config.ts', 'harness'],
    ['tests/playwright.config.ts', 'harness'],
    ['tests/e2e/smoke.spec.ts', undefined],
    ['packages/modules/booking/stryker.config.mjs', 'harness'],
    ['packages/modules/booking/domain/booking.ts', undefined],
    ['apps/web/src/app/page.tsx', undefined],
    ['README.md', undefined],
  ])('%s → %s', (path, area) => {
    expect(classifyPath(path, ctx)).toBe(area);
    expect(classifyPath(`/repo/${path}`, ctx)).toBe(area);
  });

  test('~/.claude はどの役割でも書き込めない領域', () => {
    expect(classifyPath('/home/u/.claude/settings.json', ctx)).toBe('user-claude-config');
    expect(classifyPath('~/.claude/settings.json', ctx)).toBe('user-claude-config');
  });

  test('プロジェクト外の一般のパスは対象外', () => {
    expect(classifyPath('/tmp/x.txt', ctx)).toBeUndefined();
  });
});

describe('書き込み時の扱い(ADR-0016、ADR-0017)', () => {
  test('仕様・受け入れテスト・ハーネス・憲法はローカルでは止めない(allow。PR で守る)', () => {
    expect(DECISION.spec).toBe('allow');
    expect(DECISION['acceptance-test']).toBe('allow');
    expect(DECISION.harness).toBe('allow');
    expect(DECISION.constitution).toBe('allow');
  });

  test('~/.claude は常に拒否(deny)', () => {
    expect(DECISION['user-claude-config']).toBe('deny');
  });
});
