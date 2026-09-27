import { describe, expect, test } from 'vitest';

import { classifyPath, isAllowed, parseRole, type ProtectedArea, type Role } from './protected-paths.ts';

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

describe('役割ごとの解除範囲', () => {
  const areas: ProtectedArea[] = ['spec', 'acceptance-test', 'harness', 'constitution', 'user-claude-config'];
  const expected: Record<Role, ProtectedArea[]> = {
    'spec-author': ['spec'],
    'test-author': ['acceptance-test'],
    implementer: [],
    reviewer: [],
    harness: ['harness'],
  };

  test.each(Object.entries(expected))('%s', (role, allowed) => {
    for (const area of areas) expect(isAllowed(role as Role, area)).toBe(allowed.includes(area));
  });

  test('憲法はどの役割でも書き込めない', () => {
    for (const role of Object.keys(expected) as Role[]) expect(isAllowed(role, 'constitution')).toBe(false);
  });
});

describe('OTA_ROLE の解釈', () => {
  test('未指定は implementer', () => {
    expect(parseRole(undefined)).toBe('implementer');
    expect(parseRole('')).toBe('implementer');
  });

  test('既知の役割はそのまま', () => {
    expect(parseRole('spec-author')).toBe('spec-author');
  });

  test('不正な値は undefined', () => {
    expect(parseRole('admin')).toBeUndefined();
  });
});
