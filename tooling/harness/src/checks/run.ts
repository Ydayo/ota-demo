// ハーネスの検査の CLI。違反があれば一覧を出力し、終了コード 1 で終わる。
//   node tooling/harness/src/checks/run.ts repo
//     リポジトリの状態の検査(Route Handler と Server Actions、要件トレーサビリティ、Grilling 記録)
//   node tooling/harness/src/checks/run.ts pr-separation --base <ref> --head <ref>
//     PR の分離の検査(base と head の merge-base から head までの変更が対象)

import { resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { formatViolations, type Violation } from './files.ts';
import { checkGrillingRecord } from './grilling-record.ts';
import { changedFilesBetween, checkPrSeparation } from './pr-separation.ts';
import { checkRoutes } from './routes.ts';
import { checkTraceability } from './traceability.ts';

const root = resolve(import.meta.dirname, '../../../..');

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: { base: { type: 'string' }, head: { type: 'string' } },
});

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
  ok = report([
    ['Route Handler と Server Actions(ADR-0010)', () => checkRoutes(root)],
    ['要件トレーサビリティ(ADR-0005)', () => checkTraceability(root)],
    ['Grilling 記録(ADR-0005)', () => checkGrillingRecord(root)],
  ]);
} else if (command === 'pr-separation' && values.base !== undefined && values.head !== undefined) {
  const { base, head } = values;
  ok = report([['PR の分離(ADR-0016)', () => checkPrSeparation(changedFilesBetween(root, base, head))]]);
} else {
  process.stderr.write('使い方: run.ts repo | run.ts pr-separation --base <ref> --head <ref>\n');
  ok = false;
}
process.exitCode = ok ? 0 : 1;
