// 変更提案の「Grilling 記録」欄の検査(ADR-0005)。
// 進行中の変更提案(openspec/changes/<name>/、archive を除く)の proposal.md に「## Grilling 記録」欄があり、
// 「- Q: 質問 → A: 決定事項」の形の記録が1行以上あること。テンプレートのままの空欄は認めない。

import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { readText, type Violation } from './files.ts';

const SECTION = /^##\s+Grilling 記録\s*$/;
const RECORD = /^\s*[-*]\s*Q:\s*\S.*?\s*(?:→|->)\s*A:\s*\S/;

const ADR = 'docs/adr/0005-spec-driven-development-with-openspec.md';

const changeNames = (root: string): string[] => {
  const dir = join(root, 'openspec/changes');
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name !== 'archive')
    .map((e) => e.name)
    .sort();
};

/** 「## Grilling 記録」から次の「## 」までの本文(HTML コメントを除く)。欄がなければ undefined */
const grillingSection = (markdown: string): string | undefined => {
  const lines = markdown.replace(/<!--[\s\S]*?-->/g, '').split('\n');
  const start = lines.findIndex((l) => SECTION.test(l));
  if (start === -1) return undefined;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => /^##?\s/.test(l));
  return (end === -1 ? rest : rest.slice(0, end)).join('\n');
};

export const checkGrillingRecord = (root: string): Violation[] =>
  changeNames(root).flatMap((name): Violation[] => {
    const file = `openspec/changes/${name}/proposal.md`;
    if (!existsSync(join(root, file))) {
      return [{ file, message: `変更提案に proposal.md がありません(${ADR})` }];
    }
    const section = grillingSection(readText(root, file));
    if (section === undefined) {
      return [{ file, message: `「## Grilling 記録」欄がありません(${ADR})` }];
    }
    if (!section.split('\n').some((l) => RECORD.test(l))) {
      return [
        {
          file,
          message: `「Grilling 記録」欄に記録がありません。「- Q: 質問 → A: 決定事項」の形で1行以上書いてください(${ADR})`,
        },
      ];
    }
    return [];
  });
