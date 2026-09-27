import { expect, test } from 'vitest';

import { buildApi } from './api';
import { openApiDocument } from './openapi';

// apps/web/openapi.json は API の現在の定義。CI はこのファイルの base との差分で破壊的変更を検知する。
// API を変更したら `pnpm vitest run --project unit -u apps/web/src/server/openapi.test.ts` で更新する。
test('apps/web/openapi.json が API の定義と一致している', async () => {
  const api = buildApi({ pingDatabase: () => Promise.resolve(), resolveSession: () => Promise.resolve(null) });
  await expect(`${JSON.stringify(openApiDocument(api), null, 2)}\n`).toMatchFileSnapshot('../../openapi.json');
});
