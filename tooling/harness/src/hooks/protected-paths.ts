// 書き込みロックの対象と、役割ごとの解除範囲(ADR-0006)。

export const ROLES = ['spec-author', 'test-author', 'implementer', 'reviewer', 'harness'] as const;
export type Role = (typeof ROLES)[number];

export type ProtectedArea =
  | 'spec' // 仕様・用語集・ADR
  | 'acceptance-test' // 受け入れテスト
  | 'harness' // hooks、CI、検査スクリプト、閾値設定、CLAUDE.md
  | 'constitution' // 憲法(どの役割でも書き込めない)
  | 'user-claude-config'; // ~/.claude(どの役割でも書き込めない)

const ALLOWED: Record<Role, readonly ProtectedArea[]> = {
  'spec-author': ['spec'],
  'test-author': ['acceptance-test'],
  implementer: [],
  reviewer: [],
  harness: ['harness'],
};

/** 環境変数 OTA_ROLE を解釈する。未指定は implementer。不正な値は undefined */
export const parseRole = (value: string | undefined): Role | undefined => {
  if (value === undefined || value === '') return 'implementer';
  return (ROLES as readonly string[]).includes(value) ? (value as Role) : undefined;
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
  // OpenSpec のスキーマと設定は Grilling の強制を含むため、仕様ではなくハーネスとして扱う
  if (path.startsWith('openspec/schemas/') || path === 'openspec/config.yaml') return 'harness';
  if (
    path.startsWith('openspec/') ||
    path === 'CONTEXT-MAP.md' ||
    base === 'CONTEXT.md' ||
    path.startsWith('docs/adr/') ||
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

export const isAllowed = (role: Role, area: ProtectedArea): boolean => ALLOWED[role].includes(area);

export const ADR_LOCK = 'docs/adr/0006-write-locks-for-specs-and-acceptance-tests.md';

export const lockMessage = (target: string, area: ProtectedArea, role: Role): string =>
  [
    `書き込みはロックされています: ${target}(保護対象: ${area}、現在の役割: ${role})`,
    '迂回せずに作業を止め、人間に報告してください。',
    `根拠: ${ADR_LOCK}`,
  ].join('\n');
