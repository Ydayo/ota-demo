// PreToolUse hook(ADR-0016、ADR-0017):
// - ~/.claude への書き込みと、ゲートの迂回は常に拒否する(deny)
// - 保護対象(仕様・用語集・ADR、受け入れテスト、ハーネス、憲法)への書き込みはローカルでは止めない。
//   PR のレビュー、CODEOWNERS、CI の PR の分離の検査で守る(ADR-0017)

import { checkBash } from './bash-guard.ts';
import { block, pathContext, readInput, str } from './io.ts';
import { classifyPath, DECISION, denyMessage } from './protected-paths.ts';

const FILE_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);

const input = await readInput();
const toolName = str(input['tool_name']) ?? '';
const toolInput = (input['tool_input'] ?? {}) as Record<string, unknown>;
const ctx = pathContext();

if (FILE_TOOLS.has(toolName)) {
  const target = str(toolInput['file_path']) ?? str(toolInput['notebook_path']);
  const area = target === undefined ? undefined : classifyPath(target, ctx);
  if (target !== undefined && area !== undefined && DECISION[area] === 'deny') block(denyMessage(target, area));
} else if (toolName === 'Bash') {
  const verdict = checkBash(str(toolInput['command']) ?? '', ctx);
  if (verdict.decision === 'deny') block(verdict.reason);
}
