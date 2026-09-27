// 保護対象と、書き込み時の扱い(ADR-0016)。
// - ask: Claude Code の確認ダイアログで人間が毎回許可する
// - deny: どんな場合も AI には書き込ませない

export type ProtectedArea =
  | 'spec' // 仕様・用語集・ADR
  | 'acceptance-test' // 受け入れテスト
  | 'harness' // hooks、CI、検査スクリプト、閾値設定、CLAUDE.md、OpenSpec のスキーマ
  | 'constitution' // 憲法(ADR-0016 により、他の保護対象と同じく人間の確認で変更できる)
  | 'user-claude-config'; // ~/.claude

export type Decision = 'ask' | 'deny';

export const DECISION: Record<ProtectedArea, Decision> = {
  spec: 'ask',
  'acceptance-test': 'ask',
  harness: 'ask',
  constitution: 'ask',
  'user-claude-config': 'deny',
};

const HARNESS_FILES = new Set([
  'eslint.config.js',
  '.dependency-cruiser.cjs',
  'vitest.config.ts',
  'tsconfig.base.json',
  'turbo.json',
  'skills-lock.json',
]);

/** プロジェクトルートからの相対パス(区切りは /)を分類する */
export const classifyRelative = (rel: string): ProtectedArea | undefined => {
  const path = rel.replace(/^\.\//, '');
  const base = path.split('/').pop() ?? path;
  if (path === 'docs/constitution.md') return 'constitution';
  // OpenSpec のスキーマと設定は Grilling の強制を含むため、仕様ではなくハーネスとして扱う(ADR-0015)
  if (path.startsWith('openspec/schemas/') || path === 'openspec/config.yaml') return 'harness';
  if (
    path.startsWith('openspec/') ||
    path === 'CONTEXT-MAP.md' ||
    base === 'CONTEXT.md' ||
    /(^|\/)docs\/adr\//.test(path)
  ) {
    return 'spec';
  }
  if (path.startsWith('tests/acceptance/')) return 'acceptance-test';
  if (
    path.startsWith('.claude/') ||
    path.startsWith('.github/') ||
    path.startsWith('tooling/harness/') ||
    base === 'CLAUDE.md' ||
    base === 'CLAUDE.local.md' ||
    HARNESS_FILES.has(path) ||
    /(^|\/)stryker\.config\.[cm]?[jt]s$/.test(path)
  ) {
    return 'harness';
  }
  return undefined;
};

export type PathContext = { readonly projectDir: string; readonly homeDir: string };

const normalize = (p: string): string => p.replace(/\/+$/, '').replace(/\/{2,}/g, '/');

/** 絶対パスまたは相対パス(プロジェクトルート基準)を分類する */
export const classifyPath = (target: string, ctx: PathContext): ProtectedArea | undefined => {
  const home = normalize(ctx.homeDir);
  const expanded = target.startsWith('~/') ? `${home}/${target.slice(2)}` : target;
  const project = normalize(ctx.projectDir);
  if (expanded.startsWith('/')) {
    const abs = normalize(expanded);
    if (abs === `${home}/.claude` || abs.startsWith(`${home}/.claude/`)) return 'user-claude-config';
    if (abs.startsWith(`${project}/`)) return classifyRelative(abs.slice(project.length + 1));
    return undefined;
  }
  return classifyRelative(expanded);
};

export const ADR_PROTECTION = 'docs/adr/0016-protect-by-confirmation-and-pr-separation.md';

const AREA_LABEL: Record<ProtectedArea, string> = {
  spec: '仕様・用語集・ADR',
  'acceptance-test': '受け入れテスト',
  harness: 'ハーネス',
  constitution: '憲法',
  'user-claude-config': 'ユーザーの Claude Code 設定',
};

export const askMessage = (target: string, area: ProtectedArea): string =>
  `保護対象(${AREA_LABEL[area]})への書き込みです: ${target}。人間の確認が必要です(${ADR_PROTECTION})。`;

export const denyMessage = (target: string, area: ProtectedArea): string =>
  [
    `${AREA_LABEL[area]}は AI が変更できません: ${target}`,
    '迂回せずに作業を止め、人間に報告してください。',
    `根拠: ${ADR_PROTECTION}`,
  ]
    .filter(Boolean)
    .join('\n');
