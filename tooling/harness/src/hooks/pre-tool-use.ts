// PreToolUse hook(ADR-0016):
// - 保護対象への書き込みは、Claude Code の確認ダイアログで人間に毎回確認する(ask)
// - 憲法と ~/.claude への書き込み、ゲートの迂回は常に拒否する(deny)

import { checkBash } from './bash-guard.ts';
import { block, pathContext, readInput, str } from './io.ts';
import { askMessage, classifyPath, DECISION, denyMessage } from './protected-paths.ts';

const FILE_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);

const ask = (reason: string): void => {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'ask', permissionDecisionReason: reason },
    }),
  );
};

const input = await readInput();
const toolName = str(input['tool_name']) ?? '';
const toolInput = (input['tool_input'] ?? {}) as Record<string, unknown>;
const ctx = pathContext();

if (FILE_TOOLS.has(toolName)) {
  const target = str(toolInput['file_path']) ?? str(toolInput['notebook_path']);
  const area = target === undefined ? undefined : classifyPath(target, ctx);
  if (target !== undefined && area !== undefined) {
    if (DECISION[area] === 'deny') block(denyMessage(target, area));
    else ask(askMessage(target, area));
  }
} else if (toolName === 'Bash') {
  const verdict = checkBash(str(toolInput['command']) ?? '', ctx);
  if (verdict.decision === 'deny') block(verdict.reason);
  else if (verdict.decision === 'ask') ask(verdict.reason);
}
