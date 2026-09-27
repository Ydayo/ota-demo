// 依存ルール(ADR-0004)。違反時のメッセージには根拠の ADR を含める。
// パスの先頭を (?:^|/) にしているのは、tooling/harness/fixtures/ 配下のフィクスチャにも同じルールを適用するため。

const ADR = 'docs/adr/0004-module-dependency-rules.md';
const UNIT = '(?:^|/)packages/(?:modules|products)/';
const SHARED = '(?:^|/)packages/shared/';
// テストファイルはテストライブラリに依存してよい
const TEST = '\\.test\\.ts$';

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'module-public-api',
      severity: 'error',
      comment: `他のモジュール・商材は index.ts 経由でのみ参照できる(${ADR})`,
      from: { path: `${UNIT}([^/]+)/` },
      to: {
        path: `${UNIT}[^/]+/.+`,
        pathNot: [`${UNIT}$1/`, `${UNIT}[^/]+/index\\.ts$`],
      },
    },
    {
      name: 'shared-pure',
      severity: 'error',
      comment: `@ota/shared は外部(npm パッケージ、Node 組込みモジュール、他パッケージ)に依存できない(${ADR})`,
      from: { path: SHARED, pathNot: TEST },
      to: { pathNot: SHARED },
    },
    {
      name: 'domain-pure',
      severity: 'error',
      comment: `domain は同じ層と @ota/shared にのみ依存できる(${ADR})`,
      from: { path: `${UNIT}([^/]+)/domain/`, pathNot: TEST },
      to: { pathNot: [`${UNIT}$1/domain/`, SHARED] },
    },
    {
      name: 'application-inward',
      severity: 'error',
      comment: `application は同じモジュールの domain と application、@ota/shared にのみ依存できる。他コンテキストはポート経由で使う(${ADR})`,
      from: { path: `${UNIT}([^/]+)/application/`, pathNot: TEST },
      to: { pathNot: [`${UNIT}$1/(?:domain|application)/`, SHARED] },
    },
    {
      name: 'platform-restricted',
      severity: 'error',
      comment: `@ota/platform を参照できるのは infrastructure、platform 自身、apps のみ(${ADR}、docs/adr/0008-platform-package-for-cross-cutting-concerns.md)`,
      from: {
        pathNot: [`${UNIT}[^/]+/infrastructure/`, '(?:^|/)packages/platform/', '(?:^|/)apps/'],
      },
      to: { path: '(?:^|/)packages/platform/' },
    },
    {
      name: 'modules-no-products',
      severity: 'error',
      comment: `モジュールは商材に依存できない。商材が booking の契約を実装する(${ADR})`,
      from: { path: '(?:^|/)packages/modules/' },
      to: { path: '(?:^|/)packages/products/' },
    },
    {
      name: 'products-isolated',
      severity: 'error',
      comment: `商材同士は依存できない(${ADR})`,
      from: { path: '(?:^|/)packages/products/([^/]+)/' },
      to: { path: '(?:^|/)packages/products/', pathNot: '(?:^|/)packages/products/$1/' },
    },
    {
      name: 'table-ownership',
      severity: 'error',
      comment: `テーブル定義(infrastructure/db/)は所有モジュールの外に公開できない(${ADR})`,
      from: { path: `${UNIT}[^/]+/index\\.ts$` },
      to: { path: `${UNIT}[^/]+/infrastructure/db/` },
    },
    {
      name: 'no-circular',
      severity: 'error',
      comment: `循環参照は禁止(${ADR})`,
      from: {},
      to: { circular: true },
    },
    {
      name: 'not-to-unresolvable',
      severity: 'error',
      comment: '解決できない import は禁止',
      from: {},
      to: { couldNotResolve: true },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    // node_modules は exclude しない(exclude すると npm パッケージへの依存自体が消え、domain-pure などが検出できなくなる)
    exclude: { path: ['\\.next/', '\\.turbo/', 'next-env\\.d\\.ts$'] },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'types', 'default'],
      extensions: ['.ts', '.tsx', '.js', '.mjs', '.cjs'],
      mainFields: ['module', 'main', 'types'],
    },
    reporterOptions: {
      text: { highlightFocused: true },
    },
  },
};
