// 依存ルール(ADR-0004)の自己テスト。
// フィクスチャのケースごとに dependency-cruiser を実行し、検出されたルールが期待どおりかを確かめる。
// ルールの書き間違いで違反を見逃す(常に緑になる)ことを防ぐ。

import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { describe, expect, test } from 'vitest';

const root = resolve(import.meta.dirname, '../../..');
const fixtures = join(root, 'tooling/harness/fixtures/depcruise');

const expected: Record<string, readonly string[]> = {
  'module-public-api': ['module-public-api'],
  'shared-pure': ['shared-pure'],
  'domain-pure-layer': ['domain-pure'],
  'domain-pure-npm': ['domain-pure'],
  'application-inward-infra': ['application-inward'],
  'application-inward-other-module': ['application-inward'],
  'platform-restricted': ['platform-restricted'],
  'modules-no-products': ['modules-no-products'],
  'products-isolated': ['products-isolated'],
  'table-ownership': ['table-ownership'],
  'no-circular': ['no-circular'],
  allowed: [],
};

type CruiseResult = { summary: { violations: { rule: { name: string } }[] } };

const cruise = (target: string): string[] => {
  const result = spawnSync(
    join(root, 'node_modules/.bin/depcruise'),
    [target, '--config', '.dependency-cruiser.cjs', '--output-type', 'json'],
    { cwd: root, encoding: 'utf8' },
  );
  const parsed = JSON.parse(result.stdout) as CruiseResult;
  return [...new Set(parsed.summary.violations.map((v) => v.rule.name))].sort();
};

describe('依存ルールの自己テスト(ADR-0004)', () => {
  test('すべてのフィクスチャに期待値が定義されている', () => {
    const cases = readdirSync(fixtures).sort();
    expect(cases).toEqual(Object.keys(expected).sort());
  });

  test.each(Object.entries(expected))('%s', (name, rules) => {
    expect(cruise(join('tooling/harness/fixtures/depcruise', name))).toEqual([...rules].sort());
  });
});
