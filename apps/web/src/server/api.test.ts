import { describe, expect, test } from 'vitest';

import { buildApi, type ApiDeps } from './api';

const deps = (overrides: Partial<ApiDeps> = {}): ApiDeps => ({
  pingDatabase: () => Promise.resolve(),
  resolveSession: () => Promise.resolve(null),
  ...overrides,
});

describe('API の組み立て', () => {
  test('すべてのルートが認可ポリシーを宣言している', () => {
    expect(buildApi(deps()).undeclaredRoutes()).toEqual([]);
  });
});

describe('GET /api/health', () => {
  test('DB に到達できれば 200', async () => {
    const res = await buildApi(deps()).app.request('/api/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok', database: 'ok' });
  });

  test('DB に到達できなければ 503', async () => {
    const res = await buildApi(deps({ pingDatabase: () => Promise.reject(new Error('down')) })).app.request(
      '/api/health',
    );
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ status: 'degraded', database: 'unavailable' });
  });
});
