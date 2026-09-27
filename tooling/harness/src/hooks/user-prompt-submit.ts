// UserPromptSubmit hook: OpenSpec の変更提案を作るコマンドの実行時に、Grilling を必ず行うよう促す(ADR-0005)。

import { readInput, str } from './io.ts';

export const OPSX_CHANGE_COMMAND = /^\s*\/opsx:(propose|new|continue|ff)\b/;

const input = await readInput();
const prompt = str(input['prompt']) ?? '';

if (OPSX_CHANGE_COMMAND.test(prompt)) {
  const context = [
    'proposal と specs を書き始める前に、必ず Grilling を行うこと(docs/adr/0005-spec-driven-development-with-openspec.md)。',
    '手順: Skill ツールで `grilling` を実行して計画を詰め、続けて `domain-modeling` を実行して CONTEXT.md と ADR を更新する。',
    'Grilling で出た質問と決定事項は、proposal の「Grilling 記録」欄に記録する。',
  ].join('\n');
  process.stdout.write(
    JSON.stringify({ hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: context } }),
  );
}
