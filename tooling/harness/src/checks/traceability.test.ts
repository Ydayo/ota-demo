// 要件トレーサビリティの検査の自己テスト。

import { resolve } from 'node:path';

import { describe, expect, test } from 'vitest';

import { materialize, type Fixture } from './fixture.ts';
import { checkTraceability } from './traceability.ts';

const violations = (fixture: Fixture) =>
  checkTraceability(materialize(fixture)).map((v) => ({ file: v.file, message: v.message }));

const spec = (...ids: string[]): string =>
  [
    '# booking',
    '',
    '## Requirements',
    '',
    ...ids.flatMap((id) => [
      `### Requirement: ${id} 予約する`,
      '利用者が予約したとき、システムは予約を確定しなければならない(SHALL)。',
      '',
      '#### Scenario: 予約できる',
      '- **WHEN** 予約する',
      '- **THEN** 確定する',
      '',
    ]),
  ].join('\n');

const acceptance = (...titles: string[]): string =>
  ["import { test } from 'vitest';", '', ...titles.map((t) => `test('${t}', () => {});`)].join('\n');

const SPEC = 'openspec/specs/booking/spec.md';
const TEST = 'tests/acceptance/booking.test.ts';

describe('要件トレーサビリティの検査', () => {
  test('仕様もテストもなければ成功する', () => {
    expect(violations({ 'openspec/specs/.gitkeep': '' })).toEqual([]);
  });

  test('すべての要件IDにテストがあれば成功する', () => {
    expect(
      violations({
        [SPEC]: spec('REQ-BOOKING-001', 'REQ-BOOKING-002'),
        [TEST]: acceptance('REQ-BOOKING-001: 予約できる', 'REQ-BOOKING-002 と REQ-BOOKING-001: 組み合わせ'),
      }),
    ).toEqual([]);
  });

  test('describe や test.describe のテスト名、二重引用符・テンプレート文字列も認める', () => {
    expect(
      violations({
        [SPEC]: spec('REQ-BOOKING-001', 'REQ-BOOKING-002', 'REQ-BOOKING-003'),
        [TEST]: [
          'test.describe("REQ-BOOKING-001: 予約", () => {});',
          'describe(`REQ-BOOKING-002: 取消`, () => {});',
          "it('REQ-BOOKING-003: 変更', async () => {});",
        ].join('\n'),
      }),
    ).toEqual([]);
  });

  test('テストのない要件IDを検出する', () => {
    expect(
      violations({ [SPEC]: spec('REQ-BOOKING-001', 'REQ-BOOKING-002'), [TEST]: acceptance('REQ-BOOKING-001: a') }),
    ).toEqual([{ file: SPEC, message: expect.stringContaining('REQ-BOOKING-002') as string }]);
  });

  test('要件IDがテスト名ではなくコメントにあるだけなら、テストがあるとはみなさない', () => {
    expect(
      violations({
        [SPEC]: spec('REQ-BOOKING-001'),
        [TEST]: "// REQ-BOOKING-001\nimport { test } from 'vitest';\ntest('予約できる', () => {});\n",
      }),
    ).toEqual([{ file: SPEC, message: expect.stringContaining('REQ-BOOKING-001') as string }]);
  });

  test('存在しない要件IDを参照するテストを検出する(テスト名以外の参照も含む)', () => {
    expect(
      violations({
        [SPEC]: spec('REQ-BOOKING-001'),
        [TEST]: `${acceptance('REQ-BOOKING-001: a', 'REQ-BOOKING-099: 存在しない')}\n// REQ-PAYMENT-001\n`,
      }),
    ).toEqual([
      { file: TEST, message: expect.stringContaining('REQ-BOOKING-099') as string },
      { file: TEST, message: expect.stringContaining('REQ-PAYMENT-001') as string },
    ]);
  });

  test('進行中の変更提案で追加・変更・改名した要件IDは、テストから参照できる(仕様に入るまでテストは必須ではない)', () => {
    expect(
      violations({
        [SPEC]: spec('REQ-BOOKING-001', 'REQ-BOOKING-002'),
        'openspec/changes/add-cancel/specs/booking/spec.md': [
          '## ADDED Requirements',
          '### Requirement: REQ-BOOKING-010 取り消す',
          '## MODIFIED Requirements',
          '### Requirement: REQ-BOOKING-001 予約する',
          '## RENAMED Requirements',
          '- FROM: `### Requirement: REQ-BOOKING-002 旧名`',
          '- TO: `### Requirement: REQ-BOOKING-011 新名`',
          '## REMOVED Requirements',
          '### Requirement: REQ-BOOKING-012 削除する',
        ].join('\n'),
        [TEST]: acceptance(
          'REQ-BOOKING-001: a',
          'REQ-BOOKING-002: b',
          'REQ-BOOKING-010: 取り消せる',
          'REQ-BOOKING-011: 新名',
          'REQ-BOOKING-012: 削除された要件',
        ),
      }),
    ).toEqual([{ file: TEST, message: expect.stringContaining('REQ-BOOKING-012') as string }]);
  });

  test('archive 済みの変更提案の要件IDは、存在する要件IDとみなさない', () => {
    expect(
      violations({
        'openspec/changes/archive/2026-01-01-old/specs/booking/spec.md':
          '## ADDED Requirements\n### Requirement: REQ-BOOKING-001 古い\n',
        [TEST]: acceptance('REQ-BOOKING-001: a'),
      }),
    ).toEqual([{ file: TEST, message: expect.stringContaining('REQ-BOOKING-001') as string }]);
  });

  test('要件IDのない要件の見出しを検出する', () => {
    expect(
      violations({
        [SPEC]: '### Requirement: 予約する\n',
        'openspec/changes/x/specs/booking/spec.md': '## ADDED Requirements\n### Requirement: 取り消す\n',
      }),
    ).toEqual([
      { file: SPEC, message: expect.stringContaining('要件IDがありません') as string },
      { file: 'openspec/changes/x/specs/booking/spec.md', message: expect.stringContaining('要件IDがありません') as string },
    ]);
  });

  test('仕様の中で重複した要件IDを検出する', () => {
    expect(
      violations({
        [SPEC]: spec('REQ-BOOKING-001'),
        'openspec/specs/payment/spec.md': spec('REQ-BOOKING-001'),
        [TEST]: acceptance('REQ-BOOKING-001: a'),
      }),
    ).toEqual([
      { file: 'openspec/specs/payment/spec.md', message: expect.stringContaining('重複') as string },
    ]);
  });

  test('このリポジトリに違反がない', () => {
    expect(checkTraceability(resolve(import.meta.dirname, '../../../..'))).toEqual([]);
  });
});
