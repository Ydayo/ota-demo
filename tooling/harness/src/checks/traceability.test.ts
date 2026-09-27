// 要件トレーサビリティの検査の自己テスト。

import { resolve } from 'node:path';

import { describe, expect, test } from 'vitest';

import vitestConfig from '../../../../vitest.config.ts';
import { materialize, type Fixture } from './fixture.ts';
import { ACCEPTANCE_TEST_GLOB, checkTraceability } from './traceability.ts';

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

  test('describe や test.describe の名前は中のテストに引き継ぐ。二重引用符・テンプレート文字列も認める', () => {
    expect(
      violations({
        [SPEC]: spec('REQ-BOOKING-001', 'REQ-BOOKING-002', 'REQ-BOOKING-003'),
        [TEST]: [
          'test.describe("REQ-BOOKING-001: 予約", () => { test("正常系", async () => {}); });',
          "describe(`REQ-BOOKING-002: 取消`, () => { describe('入れ子', () => { it('a', () => {}); }); });",
          "it('REQ-BOOKING-003: 変更', async () => {});",
        ].join('\n'),
      }),
    ).toEqual([]);
  });

  test('受け入れテストの対象ファイルは vitest.config.ts の acceptance と一致する', () => {
    const projects = (vitestConfig.test?.projects ?? []) as { test?: { name?: string; include?: string[] } }[];
    const acceptanceProject = projects.find((p) => p.test?.name === 'acceptance');
    expect(acceptanceProject?.test?.include).toEqual([ACCEPTANCE_TEST_GLOB]);
  });

  test.each(['tests/acceptance/a.spec.ts', 'tests/acceptance/a.test.tsx', 'tests/acceptance/helpers.ts'])(
    'CI が実行しないファイル %s のテストは数えず、違反として報告する',
    (file) => {
      expect(violations({ [SPEC]: spec('REQ-BOOKING-001'), [file]: acceptance('REQ-BOOKING-001: a') })).toEqual([
        { file, message: expect.stringContaining('CI が実行しないファイル') as string },
        { file: SPEC, message: expect.stringContaining('REQ-BOOKING-001') as string },
      ]);
    },
  );

  test('テストを含まない補助ファイルは、要件IDを参照していてもよい', () => {
    expect(
      violations({
        [SPEC]: spec('REQ-BOOKING-001'),
        [TEST]: acceptance('REQ-BOOKING-001: a'),
        'tests/acceptance/helpers.ts': "export const id = 'REQ-BOOKING-001';\n",
      }),
    ).toEqual([]);
  });

  test('テストのない要件IDを検出する', () => {
    expect(
      violations({ [SPEC]: spec('REQ-BOOKING-001', 'REQ-BOOKING-002'), [TEST]: acceptance('REQ-BOOKING-001: a') }),
    ).toEqual([{ file: SPEC, message: expect.stringContaining('REQ-BOOKING-002') as string }]);
  });

  test('test.each(...) と、変数に代入したテストのテスト名も認める', () => {
    expect(
      violations({
        [SPEC]: spec('REQ-BOOKING-001', 'REQ-BOOKING-002'),
        [TEST]: [
          "test.each([1, 2])('REQ-BOOKING-001: %s 泊', () => {});",
          "const t = it('REQ-BOOKING-002: b', { skip: false, timeout: 1000 }, () => {});",
        ].join('\n'),
      }),
    ).toEqual([]);
  });

  test.each([
    ['コメントの要件ID', "// REQ-BOOKING-001\ntest('予約できる', () => {});\n"],
    ['行コメントの中のテスト', "// test('REQ-BOOKING-001: a', () => {});\n"],
    ['ブロックコメントの中のテスト', "/*\ntest('REQ-BOOKING-001: a', () => {});\n*/\n"],
    ['test.skip', "test.skip('REQ-BOOKING-001: a', () => {});\n"],
    ['describe.skip', "describe.skip('REQ-BOOKING-001: a', () => {});\n"],
    ['test.todo', "test.todo('REQ-BOOKING-001: a');\n"],
    ['test.fixme(Playwright)', "test.fixme('REQ-BOOKING-001: a', async () => {});\n"],
    ['test.skipIf', "test.skipIf(true)('REQ-BOOKING-001: a', () => {});\n"],
    ['test.fails', "test.fails('REQ-BOOKING-001: a', () => {});\n"],
    ['describe.skip の中', "describe.skip('予約', () => { test('REQ-BOOKING-001: a', () => {}); });\n"],
    ['test.describe.fixme の中', "test.describe.fixme('予約', () => { test('REQ-BOOKING-001: a', () => {}); });\n"],
    ['オプションの skip', "test('REQ-BOOKING-001: a', { skip: true }, () => {});\n"],
    ['オプションの todo(省略記法)', "const todo = true;\ntest('REQ-BOOKING-001: a', { todo }, () => {});\n"],
    ['本体での test.skip()', "test('REQ-BOOKING-001: a', async () => { test.skip(); });\n"],
    ['describe の本体での test.fixme()', "test.describe('REQ-BOOKING-001', () => { test.fixme(); test('a', () => {}); });\n"],
    ['中にテストのない describe', "describe('REQ-BOOKING-001: a', () => {});\n"],
    ['テストではない test.step', "test('予約', async () => { await test.step('REQ-BOOKING-001: a', () => {}); });\n"],
    ['テスト以外の関数', "check('REQ-BOOKING-001: a');\n"],
  ])('実行されるテストがあるとはみなさない: %s', (_, content) => {
    expect(violations({ [SPEC]: spec('REQ-BOOKING-001'), [TEST]: content })).toEqual([
      { file: SPEC, message: expect.stringContaining('REQ-BOOKING-001') as string },
    ]);
  });

  test('業務上のディレクトリ名(reports、coverage など)の下も検査する', () => {
    expect(
      violations({
        'openspec/specs/reports/spec.md': spec('REQ-REPORT-001'),
        'tests/acceptance/coverage/a.test.ts': acceptance('REQ-REPORT-001: a', 'REQ-REPORT-999: b'),
      }),
    ).toEqual([
      { file: 'tests/acceptance/coverage/a.test.ts', message: expect.stringContaining('REQ-REPORT-999') as string },
    ]);
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

  test('差分の節の見出しの大文字小文字と、RENAMED の行頭の記号の違いを OpenSpec と同じく許す', () => {
    expect(
      violations({
        'openspec/changes/x/specs/booking/spec.md': [
          '## Added Requirements',
          '### Requirement: REQ-BOOKING-010 取り消す',
          '## renamed requirements',
          '* FROM: `### Requirement: REQ-BOOKING-001 旧名`',
          'TO: `###Requirement: REQ-BOOKING-011 新名`',
        ].join('\n'),
        [TEST]: acceptance('REQ-BOOKING-010: a', 'REQ-BOOKING-011: b'),
      }),
    ).toEqual([]);
  });

  test('コードブロックの中の要件の見出しは、OpenSpec と同じく無視する', () => {
    expect(
      violations({
        [SPEC]: `${spec('REQ-BOOKING-001')}\n\`\`\`md\n### Requirement: 例\n### Requirement: REQ-BOOKING-002 例\n\`\`\`\n`,
        [TEST]: acceptance('REQ-BOOKING-001: a'),
      }),
    ).toEqual([]);
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

  test.each([
    ['要件IDがない', '### Requirement: 予約する'],
    ['コロンがない', '### Requirement REQ-BOOKING-001 予約する'],
    ['見出しの階層が違う', '#### Requirement: REQ-BOOKING-001 予約する'],
    ['番号が3桁でない', '### Requirement: REQ-BOOKING-0001 予約する'],
    ['コンテキストが小文字', '### Requirement: REQ-booking-001 予約する'],
  ])('形式の崩れた要件の見出しを検出する: %s', (_, heading) => {
    const malformed = { message: expect.stringContaining('の形で書いてください') as string };
    expect(
      violations({
        [SPEC]: `${heading}\n`,
        'openspec/changes/x/specs/booking/spec.md': `## ADDED Requirements\n${heading}\n`,
      }),
    ).toEqual([
      { file: SPEC, ...malformed },
      { file: 'openspec/changes/x/specs/booking/spec.md', ...malformed },
    ]);
  });

  test('変更提案の ADDED で、仕様にある要件IDを再利用すると検出する', () => {
    const delta = 'openspec/changes/x/specs/booking/spec.md';
    expect(
      violations({
        [SPEC]: spec('REQ-BOOKING-001'),
        [delta]: '## ADDED Requirements\n### Requirement: REQ-BOOKING-001 別の要件\n',
        [TEST]: acceptance('REQ-BOOKING-001: a'),
      }),
    ).toEqual([{ file: delta, message: expect.stringContaining('ADDED の要件ID REQ-BOOKING-001') as string }]);
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
