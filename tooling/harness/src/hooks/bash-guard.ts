// Bash コマンドの検査(ADR-0016、憲法 第4条)。
// ヒューリスティックであり、完全には防げない。最終防衛線は CODEOWNERS・ルールセット・CI。

import {
  askMessage,
  classifyPath,
  DECISION,
  denyMessage,
  type PathContext,
} from './protected-paths.ts';

export type Verdict =
  | { readonly decision: 'allow' }
  | { readonly decision: 'ask'; readonly reason: string }
  | { readonly decision: 'deny'; readonly reason: string };

const ALLOW: Verdict = { decision: 'allow' };

const FORBIDDEN: readonly { pattern: RegExp; reason: string }[] = [
  { pattern: /--no-verify\b/, reason: 'Git hooks の迂回(--no-verify)は禁止です(憲法 第4条)' },
  {
    pattern: /\bgit\s+push\b[^;&|]*\s(--force(-with-lease)?|-f)(\s|$)/,
    reason: '強制 push は禁止です(憲法 第4条)',
  },
  {
    pattern: /(^|[;&|(]\s*|\s)(\w+=\S*\s+)*(\S*\/)?claude(\s|$)/,
    reason: 'Bash から Claude Code を起動することは禁止です(確認ダイアログを迂回できるため。ADR-0016)',
  },
  { pattern: /\bgh\s+auth\b/, reason: 'GitHub の認証の操作は禁止です(ADR-0007)' },
];

// 引数のパスを書き換える可能性があるコマンド
const WRITING_COMMANDS =
  /(^|[;&|(]\s*)(sudo\s+)?(rm|mv|cp|touch|mkdir|rmdir|ln|chmod|chown|truncate|install|rsync|unlink|tee|sed\s+(-[a-zA-Z]*i|--in-place)|perl\s+-[a-zA-Z]*i|git\s+(rm|mv|checkout|restore|apply|am))\b/;

// スクリプト言語の実行(中でファイルを書き換えられる)
const SCRIPTING = /(^|[;&|(]\s*)(python3?|node|ruby|perl|deno|bun|npx\s+tsx|tsx)\b/;

const tokenize = (command: string): string[] =>
  command
    .split(/[\s;&|()<>'"`]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0 && !t.startsWith('-'));

const redirectTargets = (command: string): string[] =>
  [...command.matchAll(/(?:^|[^0-9&<])>>?\s*([^\s;&|<>]+)/g)].map((m) => m[1] ?? '').filter(Boolean);

export const checkBash = (command: string, ctx: PathContext): Verdict => {
  for (const { pattern, reason } of FORBIDDEN) {
    if (pattern.test(command)) return { decision: 'deny', reason };
  }

  const candidates = new Set<string>(redirectTargets(command));
  if (WRITING_COMMANDS.test(command) || SCRIPTING.test(command)) {
    for (const token of tokenize(command)) candidates.add(token);
  }

  let ask: Verdict | undefined;
  for (const target of candidates) {
    const area = classifyPath(target, ctx);
    if (area === undefined) continue;
    if (DECISION[area] === 'deny') return { decision: 'deny', reason: denyMessage(target, area) };
    ask ??= { decision: 'ask', reason: askMessage(target, area) };
  }
  return ask ?? ALLOW;
};
