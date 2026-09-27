// Grilling 記録の検査(ADR-0005)の自己テスト。

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, test } from 'vitest';

import { materialize, type Fixture } from './fixture.ts';
import { checkGrillingRecord } from './grilling-record.ts';

const root = resolve(import.meta.dirname, '../../../..');
const template = readFileSync(resolve(root, 'openspec/schemas/ota-flow/templates/proposal.md'), 'utf8');

const PROPOSAL = 'openspec/changes/add-search/proposal.md';

const violations = (fixture: Fixture) => checkGrillingRecord(materialize(fixture));

const withRecord = (record: string): string => template.replace(/^- Q: {2}→ A: $/m, record);

describe('Grilling 記録の検査(ADR-0005)', () => {
  test('変更提案がなければ成功する', () => {
    expect(violations({ 'openspec/changes/archive/.gitkeep': '' })).toEqual([]);
  });

  test('記録が1行以上あれば成功する', () => {
    expect(
      violations({ [PROPOSAL]: withRecord('- Q: 検索の対象は? → A: 空室のあるホテルのみ(ADR-0020)') }),
    ).toEqual([]);
  });

  test('矢印は -> でもよい', () => {
    expect(violations({ [PROPOSAL]: withRecord('- Q: 並び順は? -> A: 料金の安い順') })).toEqual([]);
  });

  test('テンプレートのままの空欄を検出する', () => {
    expect(template).toMatch(/^- Q: {2}→ A: $/m);
    expect(violations({ [PROPOSAL]: template })).toEqual([
      { file: PROPOSAL, message: expect.stringContaining('記録がありません') as string },
    ]);
  });

  test.each([
    ['質問が空', '- Q:  → A: 空室のみ'],
    ['決定事項が空', '- Q: 検索の対象は? → A: '],
    ['書式が違う', '検索の対象は空室のあるホテルのみ'],
  ])('記録として認めない: %s', (_, record) => {
    expect(violations({ [PROPOSAL]: withRecord(record) })).toHaveLength(1);
  });

  test('HTML コメントの中の記録は認めない', () => {
    expect(violations({ [PROPOSAL]: withRecord('<!-- - Q: a → A: b -->') })).toHaveLength(1);
  });

  test('別の欄に書かれた記録は認めない', () => {
    const proposal = `${template}\n## その他\n\n- Q: a → A: b\n`;
    expect(violations({ [PROPOSAL]: proposal })).toHaveLength(1);
  });

  test('「Grilling 記録」欄がなければ検出する', () => {
    expect(violations({ [PROPOSAL]: '# Proposal\n\n## Why\n\n- Q: a → A: b\n' })).toEqual([
      { file: PROPOSAL, message: expect.stringContaining('欄がありません') as string },
    ]);
  });

  test('proposal.md のない変更提案を検出する', () => {
    expect(violations({ 'openspec/changes/add-search/design.md': '# Design\n' })).toEqual([
      { file: PROPOSAL, message: expect.stringContaining('proposal.md がありません') as string },
    ]);
  });

  test('archive 済みの変更提案は検査しない', () => {
    expect(violations({ 'openspec/changes/archive/2026-01-01-old/proposal.md': '# Proposal\n' })).toEqual([]);
  });

  test('このリポジトリに違反がない', () => {
    expect(checkGrillingRecord(root)).toEqual([]);
  });
});
