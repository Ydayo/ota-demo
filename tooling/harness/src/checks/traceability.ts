// 要件トレーサビリティの検査(憲法 第1条・第2条、ADR-0005)。
// - 要件の見出しは `### Requirement: REQ-<コンテキスト>-<3桁> <要件名>` の形で、仕様の中で要件IDは重複しない
// - openspec/specs のすべての要件IDを、テスト名に含む受け入れテストが tests/acceptance/ にある
//   (コメントの中のテストや、skip / todo などの実行されないテストは数えない)
// - 受け入れテストが参照する要件IDは、openspec/specs か、進行中の変更提案の追加・変更・改名後の要件に存在する
//   (受け入れテストは実装より前、変更提案を archive する前に書くため)
// - 変更提案の ADDED は、仕様にある要件IDを再利用しない
// 仕様が空の間は、要件がないので成功する。

import { parse, testTitles } from './ast.ts';
import { listFiles, readText, type Violation } from './files.ts';

const ID_SOURCE = String.raw`REQ-[A-Z][A-Z0-9]*-\d{3}`;
const ANY_ID = new RegExp(String.raw`\b${ID_SOURCE}\b`, 'g');
// 要件の見出しらしい行(形式の崩れを検出するため、見出しの階層やコロンの有無を問わない)
const REQUIREMENT_LIKE = /^#{1,6}\s*Requirement\b/i;
const HEADING_WITH_ID = new RegExp(String.raw`^###\s+Requirement:\s+(${ID_SOURCE})(?=\s|$)`);
const DELTA_SECTION = /^##\s+(ADDED|MODIFIED|REMOVED|RENAMED)\s+Requirements\s*$/;
const RENAMED_TO = new RegExp(String.raw`^\s*-\s*TO:\s*\x60?###\s+Requirement:\s+(${ID_SOURCE})(?=\s|\x60|$)`);
const SOURCE = /\.[cm]?[jt]sx?$/;

const ADR = 'docs/adr/0005-spec-driven-development-with-openspec.md';

type Requirement = { readonly id: string; readonly file: string };

const specFiles = (root: string): string[] =>
  listFiles(root, 'openspec/specs').filter((f) => f.endsWith('/spec.md'));

const changeSpecFiles = (root: string): string[] =>
  listFiles(root, 'openspec/changes').filter(
    (f) => /^openspec\/changes\/[^/]+\/specs\/.+\/spec\.md$/.test(f) && !f.startsWith('openspec/changes/archive/'),
  );

const idsIn = (text: string): string[] => [...text.matchAll(ANY_ID)].map((m) => m[0]);

const malformed = (file: string, line: string): Violation => ({
  file,
  message: `要件の見出しは「### Requirement: REQ-<コンテキスト>-<3桁> <要件名>」の形で書いてください: "${line.trim()}"(${ADR})`,
});

/** 見出しから要件IDを取り出す。要件の見出しでなければ null、形式が崩れていれば undefined */
const headingId = (line: string): string | null | undefined => {
  if (!REQUIREMENT_LIKE.test(line)) return null;
  return HEADING_WITH_ID.exec(line)?.[1];
};

/** 仕様(現在の仕様)の要件 */
const parseSpec = (root: string, file: string): { requirements: Requirement[]; violations: Violation[] } => {
  const requirements: Requirement[] = [];
  const violations: Violation[] = [];
  for (const line of readText(root, file).split('\n')) {
    const id = headingId(line);
    if (id === undefined) violations.push(malformed(file, line));
    else if (id !== null) requirements.push({ id, file });
  }
  return { requirements, violations };
};

/** 変更提案の差分仕様の、追加した要件IDと、archive 後に仕様に残る要件ID(追加・変更・改名後) */
const parseDelta = (
  root: string,
  file: string,
): { added: string[]; remaining: string[]; violations: Violation[] } => {
  const added: string[] = [];
  const remaining: string[] = [];
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
      if (renamed !== undefined) remaining.push(renamed);
      continue;
    }
    const id = headingId(line);
    if (id === undefined) {
      violations.push(malformed(file, line));
      continue;
    }
    if (id === null) continue;
    if (section === 'ADDED') added.push(id);
    if (section === 'ADDED' || section === 'MODIFIED') remaining.push(id);
  }
  return { added, remaining, violations };
};

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
    violations.push(...parsed.violations);
    for (const id of parsed.added) {
      const existing = firstFile.get(id);
      if (existing !== undefined) {
        violations.push({
          file,
          message: `ADDED の要件ID ${id} は仕様にすでにあります(${existing})。新しい要件IDを使うか、MODIFIED にしてください`,
        });
      }
    }
    for (const id of parsed.remaining) known.add(id);
  }

  const tested = new Set<string>();
  for (const file of listFiles(root, 'tests/acceptance').filter((f) => SOURCE.test(f))) {
    const text = readText(root, file);
    for (const title of testTitles(parse(file, text))) for (const id of idsIn(title)) tested.add(id);
    // 存在の検査は、テスト名に限らずファイル内のすべての参照を対象にする
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
        message: `要件ID ${id} を検証する受け入れテストが tests/acceptance/ にありません(実行されるテストのテスト名に要件IDを含めてください)`,
      });
    }
  }

  return violations;
};
