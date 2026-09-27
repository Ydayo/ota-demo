// ソースコードの構文解析(TypeScript のコンパイラ API。ADR-0012 により typescript は TS6)。
// 正規表現では、コメントの中の記述や、1行に複数の文を書いた場合を正しく扱えないため、構文木で判定する。

import ts from 'typescript';

const scriptKind = (file: string): ts.ScriptKind => {
  if (file.endsWith('.tsx')) return ts.ScriptKind.TSX;
  if (file.endsWith('.jsx')) return ts.ScriptKind.JSX;
  if (/\.[cm]?ts$/.test(file)) return ts.ScriptKind.TS;
  return ts.ScriptKind.JS;
};

export const parse = (file: string, text: string): ts.SourceFile =>
  ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, scriptKind(file));

/** 文の並びの先頭にあるディレクティブ(文字列リテラルだけの式文の連続)に directive があるか */
const hasDirective = (statements: readonly ts.Statement[], directive: string): boolean => {
  for (const statement of statements) {
    if (!ts.isExpressionStatement(statement) || !ts.isStringLiteral(statement.expression)) return false;
    if (statement.expression.text === directive) return true;
  }
  return false;
};

/** ファイルの先頭、または関数の本体の先頭に 'use server' ディレクティブがあるか */
export const hasUseServer = (source: ts.SourceFile): boolean => {
  if (hasDirective(source.statements, 'use server')) return true;
  let found = false;
  const visit = (node: ts.Node): void => {
    if (found) return;
    if (ts.isFunctionLike(node) && 'body' in node && node.body !== undefined && ts.isBlock(node.body)) {
      if (hasDirective(node.body.statements, 'use server')) {
        found = true;
        return;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
};

/**
 * 実行されるコードがあるか。import / export の宣言(`export {}` や再エクスポート)、型だけの宣言、
 * declare の宣言しかないファイルには、ミューテーションテストで変異させるものがない。
 */
export const hasExecutableCode = (source: ts.SourceFile): boolean =>
  source.statements.some(
    (s) =>
      !(
        ts.isImportDeclaration(s) ||
        ts.isExportDeclaration(s) ||
        ts.isTypeAliasDeclaration(s) ||
        ts.isInterfaceDeclaration(s) ||
        ts.isEmptyStatement(s) ||
        (ts.canHaveModifiers(s) && ts.getModifiers(s)?.some((m) => m.kind === ts.SyntaxKind.DeclareKeyword) === true)
      ),
  );

const TEST_FUNCTIONS = new Set(['test', 'it', 'describe']);
// 実行されない、条件によって実行されない、または失敗を期待するテストの修飾子
const NOT_RUN = new Set(['skip', 'todo', 'fixme', 'skipIf', 'runIf', 'fails']);
// テストの実行に影響しない修飾子(これ以外の修飾子の呼び出し、例えば test.step や test.beforeEach はテストではない)
const RUN_MODIFIERS = new Set(['describe', 'each', 'for', 'concurrent', 'sequential', 'serial', 'parallel', 'only']);
// テストのオプション(第2引数のオブジェクト)で、テストを実行しないもの
const NOT_RUN_OPTIONS = new Set(['skip', 'todo', 'fails']);

/** test.describe や test.each(...) のような呼び出し先を、名前の並び(['test', 'each'])にする */
const calleeChain = (expression: ts.Expression): string[] | undefined => {
  if (ts.isIdentifier(expression)) return [expression.text];
  if (ts.isPropertyAccessExpression(expression)) {
    const base = calleeChain(expression.expression);
    return base === undefined ? undefined : [...base, expression.name.text];
  }
  if (ts.isCallExpression(expression)) return calleeChain(expression.expression);
  return undefined;
};

const titleOf = (arg: ts.Expression | undefined, source: ts.SourceFile): string | undefined => {
  if (arg === undefined) return undefined;
  if (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg)) return arg.text;
  if (ts.isTemplateExpression(arg)) return arg.getText(source);
  return undefined;
};

/** test / it / describe(とその修飾子)の呼び出しなら、呼び出し先の名前の並び(['test', 'describe', 'skip'] など)を返す */
const testCallee = (call: ts.CallExpression): string[] | undefined => {
  const chain = calleeChain(call.expression);
  if (chain === undefined || !TEST_FUNCTIONS.has(chain[0] ?? '')) return undefined;
  return chain.slice(1).every((m) => RUN_MODIFIERS.has(m) || NOT_RUN.has(m)) ? chain : undefined;
};

/** { skip: true } のようなオプションで、実行しないことにしているか(値が false のときは実行する) */
const disabledByOptions = (args: readonly ts.Expression[]): boolean =>
  args.some(
    (arg) =>
      ts.isObjectLiteralExpression(arg) &&
      arg.properties.some(
        (p) =>
          (ts.isPropertyAssignment(p) || ts.isShorthandPropertyAssignment(p)) &&
          NOT_RUN_OPTIONS.has(p.name.getText()) &&
          !(ts.isPropertyAssignment(p) && p.initializer.kind === ts.SyntaxKind.FalseKeyword),
      ),
  );

/** テストの本体で test.skip() / test.fixme() のようにテスト名なしで呼び、実行時にスキップしているか */
const skipsAtRuntime = (body: ts.Node, source: ts.SourceFile): boolean => {
  let found = false;
  const visit = (node: ts.Node): void => {
    if (found) return;
    if (ts.isCallExpression(node)) {
      const callee = testCallee(node);
      if (callee !== undefined) {
        if (titleOf(node.arguments[0], source) !== undefined) return; // 入れ子のテストはそれぞれで判定する
        if (callee.some((m) => NOT_RUN.has(m))) {
          found = true;
          return;
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(body, visit);
  return found;
};

type Scope = { readonly names: readonly string[]; readonly skipped: boolean };

/**
 * 実行されるテストの名前。describe の名前を「 > 」でつなげて前に付ける(例: "予約 > REQ-BOOKING-001: 予約できる")。
 * 次のテストは含まない: コメントの中の呼び出し、skip / todo / fixme / skipIf / runIf / fails の修飾子、
 * これらの修飾子の describe の中、{ skip: true } などのオプション、本体での test.skip() などの呼び出し。
 * 中にテストのない describe の名前も含まない。
 */
export const testNames = (source: ts.SourceFile): string[] => {
  const names: string[] = [];
  const visit = (node: ts.Node, scope: Scope): void => {
    if (ts.isCallExpression(node)) {
      const callee = testCallee(node);
      const title = titleOf(node.arguments[0], source);
      if (callee !== undefined && title !== undefined) {
        const skipped =
          scope.skipped ||
          callee.some((m) => NOT_RUN.has(m)) ||
          disabledByOptions(node.arguments) ||
          node.arguments.some((arg) => ts.isFunctionLike(arg) && skipsAtRuntime(arg, source));
        const inner: Scope = { names: [...scope.names, title], skipped };
        if (!callee.includes('describe') && !skipped) names.push(inner.names.join(' > '));
        for (const arg of node.arguments) visit(arg, inner);
        return;
      }
    }
    ts.forEachChild(node, (child) => {
      visit(child, scope);
    });
  };
  visit(source, { names: [], skipped: false });
  return names;
};
