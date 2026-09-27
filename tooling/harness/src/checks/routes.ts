// Route Handler と Server Actions の検査(ADR-0010)。
// - Route Handler(app/**/route.ts)は、Hono のマウント先だけを許可する
// - Pages Router の API Routes(pages/api)も、defineRoute を通らない入口になるため禁止する
// - Server Actions('use server')は禁止する

import { hasUseServer, parse } from './ast.ts';
import { listFiles, readText, type Violation } from './files.ts';

export const ALLOWED_ROUTE_HANDLER = 'apps/web/src/app/api/[[...route]]/route.ts';

const ROUTE_HANDLER = /^apps\/web\/(src\/)?app\/(.+\/)?route\.[cm]?[jt]sx?$/;
const PAGES_API = /^apps\/web\/(src\/)?pages\/api\//;
const SOURCE = /\.[cm]?[jt]sx?$/;

const ADR = 'docs/adr/0010-authorization-policy-declaration.md';

export const checkRoutes = (root: string): Violation[] => {
  const violations: Violation[] = [];

  for (const file of listFiles(root, 'apps/web')) {
    if (ROUTE_HANDLER.test(file) && file !== ALLOWED_ROUTE_HANDLER) {
      violations.push({
        file,
        message: `Route Handler の追加は禁止です。API は defineRoute で定義して Hono に登録してください(${ADR})`,
      });
    } else if (PAGES_API.test(file)) {
      violations.push({
        file,
        message: `Pages Router の API Routes は禁止です。API は defineRoute で定義して Hono に登録してください(${ADR})`,
      });
    }
  }

  for (const file of [...listFiles(root, 'apps'), ...listFiles(root, 'packages')]) {
    // ファイルの先頭または関数の本体に置かれた 'use server' ディレクティブ
    if (SOURCE.test(file) && hasUseServer(parse(file, readText(root, file)))) {
      violations.push({
        file,
        message: `Server Actions('use server')は禁止です。書き込みは Hono の API 経由にしてください(${ADR})`,
      });
    }
  }

  return violations;
};
