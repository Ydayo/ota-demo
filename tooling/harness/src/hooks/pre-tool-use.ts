// PreToolUse hook: 保護対象への書き込みと、ゲートの迂回をブロックする(ADR-0006)。

import { checkBash } from './bash-guard.ts';
import { block, pathContext, readInput, str } from './io.ts';
import { classifyPath, isAllowed, lockMessage, parseRole } from './protected-paths.ts';

const FILE_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);

const input = await readInput();
const toolName = str(input['tool_name']) ?? '';
const toolInput = (input['tool_input'] ?? {}) as Record<string, unknown>;
const ctx = pathContext();

const role = parseRole(process.env['OTA_ROLE']);
if (role === undefined) {
  block(`OTA_ROLE の値が不正です: ${process.env['OTA_ROLE'] ?? ''}(docs/adr/0006-write-locks-for-specs-and-acceptance-tests.md)`);
} else if (FILE_TOOLS.has(toolName)) {
  const target = str(toolInput['file_path']) ?? str(toolInput['notebook_path']);
  if (target !== undefined) {
    const area = classifyPath(target, ctx);
    if (area !== undefined && !isAllowed(role, area)) block(lockMessage(target, area, role));
  }
} else if (toolName === 'Bash') {
  const verdict = checkBash(str(toolInput['command']) ?? '', role, ctx);
  if (!verdict.allowed) block(verdict.reason);
}
