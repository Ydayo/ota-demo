// CI のワークフロー(ADR-0018)の構成の検査。
// ジョブを追加したのに ci-ok の needs に入れ忘れると、そのジョブは必須チェックから外れてしまうため、機械的に確かめる。

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, test } from 'vitest';
import { parse } from 'yaml';

type Step = { readonly uses?: string; readonly with?: Record<string, unknown> };
type Job = { readonly if?: string; readonly needs?: readonly string[]; readonly steps?: readonly Step[] };
type Workflow = { readonly permissions?: Record<string, string>; readonly jobs: Record<string, Job> };

const root = resolve(import.meta.dirname, '../../../..');
const load = (path: string): unknown => parse(readFileSync(resolve(root, path), 'utf8'));
const workflow = load('.github/workflows/ci.yml') as Workflow;
const setupAction = load('.github/actions/setup/action.yml') as { runs: { steps: readonly Step[] } };

const allSteps: readonly Step[] = [
  ...Object.values(workflow.jobs).flatMap((job) => job.steps ?? []),
  ...setupAction.runs.steps,
];

describe('CI のワークフロー(ADR-0018)', () => {
  test('ci-ok は、ほかのすべてのジョブを needs に持つ', () => {
    const others = Object.keys(workflow.jobs).filter((name) => name !== 'ci-ok');
    expect([...(workflow.jobs['ci-ok']?.needs ?? [])].sort()).toEqual(others.sort());
  });

  test('ci-ok は依存ジョブの失敗やキャンセルでも必ず実行される(always)', () => {
    expect(workflow.jobs['ci-ok']?.if).toBe('always()');
  });

  test('ワークフローの権限は contents: read のみ', () => {
    expect(workflow.permissions).toEqual({ contents: 'read' });
  });

  test('外部の action はコミットの SHA で固定する', () => {
    const external = allSteps.flatMap((s) => (s.uses !== undefined && !s.uses.startsWith('./') ? [s.uses] : []));
    expect(external.length).toBeGreaterThan(0);
    for (const uses of external) expect(uses).toMatch(/^[\w.-]+\/[\w.-]+@[0-9a-f]{40}$/);
  });

  test('checkout は認証情報を残さない(persist-credentials: false)', () => {
    const checkouts = allSteps.filter((s) => s.uses?.startsWith('actions/checkout@') === true);
    expect(checkouts.length).toBeGreaterThan(0);
    for (const step of checkouts) expect(step.with?.['persist-credentials']).toBe(false);
  });
});
