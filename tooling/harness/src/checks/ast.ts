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

const TEST_FUNCTIONS = new Set(['test', 'it', 'describe']);
// 実行されない、または条件によって実行されないテスト
const NOT_RUN = new Set(['skip', 'todo', 'fixme', 'skipIf', 'runIf']);

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

/**
 * 実行されるテストのテスト名(test / it / describe とその修飾子の呼び出しの第1引数)。
 * コメントの中の呼び出しや、skip / todo / fixme / skipIf / runIf のものは含まない。
 */
export const testTitles = (source: ts.SourceFile): string[] => {
  const titles: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const chain = calleeChain(node.expression);
      const [first] = node.arguments;
      if (
        chain !== undefined &&
        TEST_FUNCTIONS.has(chain[0] ?? '') &&
        !chain.slice(1).some((name) => NOT_RUN.has(name)) &&
        first !== undefined
      ) {
        if (ts.isStringLiteral(first) || ts.isNoSubstitutionTemplateLiteral(first)) titles.push(first.text);
        else if (ts.isTemplateExpression(first)) titles.push(first.getText(source));
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return titles;
};
