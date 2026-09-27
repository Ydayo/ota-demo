// ハーネスの検査の CLI。違反があれば一覧を出力し、終了コード 1 で終わる。
//   node tooling/harness/src/checks/run.ts repo
//     リポジトリの状態の検査(Route Handler と Server Actions、要件トレーサビリティ、Grilling 記録)
//   node tooling/harness/src/checks/run.ts pr-separation --base <ref> --head <ref>
//     PR の分離の検査(base と head の merge-base から head までの変更が対象)
// --root <dir> で検査するリポジトリを指定できる(既定はこのスクリプトがあるリポジトリ)。
//
// 検査はコマンドごとに動的に読み込む。pr-separation は Node の組み込みモジュールだけで動き、
// CI では依存をインストールしていない base 側の版(worktree)から実行するため。

import { resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { formatViolations, type Violation } from './files.ts';

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: { base: { type: 'string' }, head: { type: 'string' }, root: { type: 'string' } },
});

const root = resolve(values.root ?? resolve(import.meta.dirname, '../../../..'));

const report = (checks: readonly (readonly [string, () => Violation[]])[]): boolean => {
  let ok = true;
  for (const [title, check] of checks) {
    const violations = check();
    if (violations.length === 0) {
      process.stdout.write(`✓ ${title}\n`);
    } else {
      ok = false;
      process.stderr.write(`${formatViolations(title, violations)}\n`);
    }
  }
  return ok;
};

const command = positionals[0];
let ok: boolean;
if (command === 'repo') {
  const { checkRoutes } = await import('./routes.ts');
  const { checkTraceability } = await import('./traceability.ts');
  const { checkGrillingRecord } = await import('./grilling-record.ts');
  ok = report([
    ['Route Handler と Server Actions(ADR-0010)', () => checkRoutes(root)],
    ['要件トレーサビリティ(ADR-0005)', () => checkTraceability(root)],
    ['Grilling 記録(ADR-0005)', () => checkGrillingRecord(root)],
  ]);
} else if (command === 'pr-separation' && values.base && values.head) {
  // 空の ref は git diff で比較対象が消え、検査を素通りさせるため拒否する(上の条件)
  const { base, head } = values;
  const { changedFilesBetween, checkPrSeparation } = await import('./pr-separation.ts');
  ok = report([['PR の分離(ADR-0016)', () => checkPrSeparation(changedFilesBetween(root, base, head))]]);
} else {
  process.stderr.write('使い方: run.ts repo | run.ts pr-separation --base <ref> --head <ref>\n');
  ok = false;
}
process.exitCode = ok ? 0 : 1;
