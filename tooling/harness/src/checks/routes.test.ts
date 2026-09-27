// Route Handler と Server Actions の検査(ADR-0010)の自己テスト。

import { resolve } from 'node:path';

import { describe, expect, test } from 'vitest';

import { materialize, type Fixture } from './fixture.ts';
import { ALLOWED_ROUTE_HANDLER, checkRoutes } from './routes.ts';

const files = (fixture: Fixture): string[] => checkRoutes(materialize(fixture)).map((v) => v.file);

const allowed: Fixture = {
  [ALLOWED_ROUTE_HANDLER]: "export const GET = () => new Response('ok');\n",
  'apps/web/src/app/page.tsx': 'export default function Page() { return null; }\n',
  'apps/web/src/server/routes/health.ts': 'export const route = 1;\n',
  // 'use server' がコメントや文字列の途中にあるだけなら違反ではない
  'packages/platform/src/a.ts': "// 'use server' は禁止(ADR-0010)\nexport const note = \"do not 'use server'\";\n",
};

describe('Route Handler と Server Actions の検査(ADR-0010)', () => {
  test('違反がなければ成功する', () => {
    expect(files(allowed)).toEqual([]);
  });

  test.each([
    'apps/web/src/app/api/booking/route.ts',
    'apps/web/src/app/hello/route.tsx',
    'apps/web/src/app/route.js',
    'apps/web/app/api/x/route.ts',
  ])('Hono のマウント先以外の Route Handler を検出する: %s', (path) => {
    expect(files({ ...allowed, [path]: 'export const GET = () => new Response();\n' })).toEqual([path]);
  });

  test.each(['apps/web/src/pages/api/x.ts', 'apps/web/pages/api/y/index.js'])(
    'Pages Router の API Routes を検出する: %s',
    (path) => {
      expect(files({ ...allowed, [path]: 'export default () => null;\n' })).toEqual([path]);
    },
  );

  test.each([
    ['ファイルの先頭', "'use server';\nexport async function save() {}\n"],
    ['二重引用符・セミコロンなし', '"use server"\nexport async function save() {}\n'],
    ['関数の本体', "export async function save() {\n  'use server';\n}\n"],
  ])('Server Actions を検出する(%s)', (_, content) => {
    for (const path of ['apps/web/src/app/actions.ts', 'packages/modules/booking/application/a.tsx']) {
      expect(files({ ...allowed, [path]: content })).toEqual([path]);
    }
  });

  test('node_modules と .next は検査しない', () => {
    expect(
      files({
        ...allowed,
        'apps/web/node_modules/x/route.ts': "'use server';\n",
        'apps/web/.next/server/app/api/route.js': "'use server';\n",
      }),
    ).toEqual([]);
  });

  test('このリポジトリに違反がない', () => {
    expect(checkRoutes(resolve(import.meta.dirname, '../../../..'))).toEqual([]);
  });
});
