// 要件トレーサビリティの検査(憲法 第1条・第2条、ADR-0005)。
// - openspec/specs の要件の見出しには要件IDがあり、要件IDは重複しない
// - openspec/specs のすべての要件IDを、テスト名に含む受け入れテストが tests/acceptance/ にある
// - 受け入れテストが参照する要件IDは、openspec/specs か、進行中の変更提案の追加・変更・改名後の要件に存在する
//   (受け入れテストは実装より前、変更提案を archive する前に書くため)
// 仕様が空の間は、要件がないので成功する。

import { listFiles, readText, type Violation } from './files.ts';

const ID_SOURCE = String.raw`REQ-[A-Z][A-Z0-9]*-\d{3}`;
const ANY_ID = new RegExp(String.raw`\b${ID_SOURCE}\b`, 'g');
const REQUIREMENT_HEADING = /^###\s+Requirement:/;
const HEADING_WITH_ID = new RegExp(String.raw`^###\s+Requirement:\s+(${ID_SOURCE})(?=\s|$)`);
const DELTA_SECTION = /^##\s+(ADDED|MODIFIED|REMOVED|RENAMED)\s+Requirements\s*$/;
const RENAMED_TO = new RegExp(String.raw`^\s*-\s*TO:\s*\x60?###\s+Requirement:\s+(${ID_SOURCE})(?=\s|\x60|$)`);
// test('...') / it('...') / describe('...') / test.describe('...') などのテスト名
const TEST_TITLE = /\b(?:test|it|describe)(?:\.[A-Za-z]+)*\s*\(\s*(['"`])((?:(?!\1)[^\\]|\\.)*)\1/g;

const ADR = 'docs/adr/0005-spec-driven-development-with-openspec.md';

type Requirement = { readonly id: string; readonly file: string };

const specFiles = (root: string): string[] =>
  listFiles(root, 'openspec/specs').filter((f) => f.endsWith('/spec.md'));

const changeSpecFiles = (root: string): string[] =>
  listFiles(root, 'openspec/changes').filter(
    (f) => /^openspec\/changes\/[^/]+\/specs\/.+\/spec\.md$/.test(f) && !f.startsWith('openspec/changes/archive/'),
  );

const idsIn = (text: string): string[] => [...text.matchAll(ANY_ID)].map((m) => m[0]);

/** 仕様(現在の仕様)の要件と、要件IDのない見出し */
const parseSpec = (root: string, file: string): { requirements: Requirement[]; violations: Violation[] } => {
  const requirements: Requirement[] = [];
  const violations: Violation[] = [];
  for (const line of readText(root, file).split('\n')) {
    if (!REQUIREMENT_HEADING.test(line)) continue;
    const id = HEADING_WITH_ID.exec(line)?.[1];
    if (id === undefined) {
      violations.push({ file, message: `要件の見出しに要件IDがありません: "${line.trim()}"(${ADR})` });
    } else {
      requirements.push({ id, file });
    }
  }
  return { requirements, violations };
};

/** 変更提案の差分仕様のうち、追加・変更・改名後の要件ID(archive 後に仕様に残るもの) */
const parseDelta = (root: string, file: string): { ids: string[]; violations: Violation[] } => {
  const ids: string[] = [];
  const violations: Violation[] = [];
  let section: string | undefined;
  for (const line of readText(root, file).split('\n')) {
    const delta = DELTA_SECTION.exec(line);
    if (delta !== null) {
      section = delta[1];
      continue;
    }
    if (/^##\s/.test(line)) {
      section = undefined;
      continue;
    }
    if (section === 'RENAMED') {
      const renamed = RENAMED_TO.exec(line)?.[1];
      if (renamed !== undefined) ids.push(renamed);
      continue;
    }
    if (!REQUIREMENT_HEADING.test(line)) continue;
    const id = HEADING_WITH_ID.exec(line)?.[1];
    if (id === undefined) {
      violations.push({ file, message: `要件の見出しに要件IDがありません: "${line.trim()}"(${ADR})` });
    } else if (section === 'ADDED' || section === 'MODIFIED') {
      ids.push(id);
    }
  }
  return { ids, violations };
};

const titleIds = (text: string): Set<string> =>
  new Set([...text.matchAll(TEST_TITLE)].flatMap((m) => idsIn(m[2] ?? '')));

export const checkTraceability = (root: string): Violation[] => {
  const violations: Violation[] = [];

  const requirements: Requirement[] = [];
  for (const file of specFiles(root)) {
    const parsed = parseSpec(root, file);
    requirements.push(...parsed.requirements);
    violations.push(...parsed.violations);
  }

  const firstFile = new Map<string, string>();
  for (const { id, file } of requirements) {
    const first = firstFile.get(id);
    if (first === undefined) firstFile.set(id, file);
    else violations.push({ file, message: `要件ID ${id} が重複しています(${first} にもあります)` });
  }

  const known = new Set(firstFile.keys());
  for (const file of changeSpecFiles(root)) {
    const parsed = parseDelta(root, file);
    for (const id of parsed.ids) known.add(id);
    violations.push(...parsed.violations);
  }

  const tested = new Set<string>();
  for (const file of listFiles(root, 'tests/acceptance').filter((f) => /\.[cm]?[jt]sx?$/.test(f))) {
    const text = readText(root, file);
    for (const id of titleIds(text)) tested.add(id);
    for (const id of new Set(idsIn(text))) {
      if (!known.has(id)) {
        violations.push({
          file,
          message: `存在しない要件ID ${id} を参照しています(openspec/specs にも、進行中の変更提案にもありません)`,
        });
      }
    }
  }

  for (const [id, file] of firstFile) {
    if (!tested.has(id)) {
      violations.push({
        file,
        message: `要件ID ${id} を検証する受け入れテストが tests/acceptance/ にありません(テスト名に要件IDを含めてください)`,
      });
    }
  }

  return violations;
};
