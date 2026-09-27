import { z } from '@hono/zod-openapi';
import { describe, expect, test } from 'vitest';

import { createApi, defineRoute } from './api';
import { policy, type Session } from './policy';

const OWNER = 'user-owner';
const OTHER = 'user-other';

const sessionFrom = (request: Request): Promise<Session | null> => {
  const userId = request.headers.get('x-test-user');
  return Promise.resolve(userId === null ? null : { userId });
};

const ok = { 200: { description: 'OK', content: { 'application/json': { schema: z.object({ ok: z.boolean() }) } } } };

const setup = () => {
  const api = createApi({ basePath: '/api', resolveSession: sessionFrom });
  api.register(defineRoute(policy.public, { method: 'get', path: '/public', responses: ok }), (c) =>
    c.json({ ok: true }, 200),
  );
  api.register(
    defineRoute(policy.authenticated, { method: 'get', path: '/private', responses: ok }),
    (c) => c.json({ ok: true }, 200),
  );
  api.register(
    defineRoute(
      policy.owner((c) => Promise.resolve(c.req.param('id') === 'missing' ? null : OWNER)),
      {
        method: 'get',
        path: '/things/{id}',
        request: { params: z.object({ id: z.string() }) },
        responses: ok,
      },
    ),
    (c) => c.json({ ok: true }, 200),
  );
  return api;
};

const get = (api: ReturnType<typeof setup>, path: string, user?: string) =>
  api.app.request(path, user === undefined ? {} : { headers: { 'x-test-user': user } });

describe('認可ポリシー(ADR-0010)', () => {
  test('public は未ログインでもアクセスできる', async () => {
    expect((await get(setup(), '/api/public')).status).toBe(200);
  });

  test('authenticated は未ログインだと 401', async () => {
    expect((await get(setup(), '/api/private')).status).toBe(401);
  });

  test('authenticated はログインしていればアクセスできる', async () => {
    expect((await get(setup(), '/api/private', OTHER)).status).toBe(200);
  });

  test('owner は未ログインだと 401', async () => {
    expect((await get(setup(), '/api/things/1')).status).toBe(401);
  });

  test('owner は他のユーザーだと、存在しないリソースと同じ 404', async () => {
    const res = await get(setup(), '/api/things/1', OTHER);
    const missing = await get(setup(), '/api/things/missing', OWNER);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual(await missing.json());
  });

  test('owner は所有者ならアクセスできる', async () => {
    expect((await get(setup(), '/api/things/1', OWNER)).status).toBe(200);
  });

  test('owner はリソースが存在しなければ 404', async () => {
    expect((await get(setup(), '/api/things/missing', OWNER)).status).toBe(404);
  });
});

describe('ルートの登録', () => {
  test('register したルートはすべて記録される', () => {
    expect(setup().registeredRoutes().map((r) => `${r.method} ${r.path}`)).toEqual([
      'GET /public',
      'GET /private',
      'GET /things/{id}',
    ]);
  });

  test('register だけを使えば未宣言のルートはない', () => {
    expect(setup().undeclaredRoutes()).toEqual([]);
  });

  test('Hono に直接登録したルートは未宣言として検出される', () => {
    const api = setup();
    api.app.get('/sneaky', (c) => c.text('no policy'));
    expect(api.undeclaredRoutes()).toEqual([{ method: 'GET', path: '/api/sneaky' }]);
  });

  test('Hono に直接登録したミドルウェアも未宣言として検出される', () => {
    const api = setup();
    api.app.use('/admin/*', async (_c, next) => {
      await next();
    });
    expect(api.undeclaredRoutes()).toHaveLength(1);
  });

  test('ログインが必要なルートの OpenAPI 定義には拒否レスポンスが含まれる', () => {
    const doc = setup().app.getOpenAPIDocument({ openapi: '3.0.0', info: { title: 't', version: '1' } });
    expect(Object.keys(doc.paths['/api/public']?.get?.responses ?? {})).toEqual(['200']);
    expect(Object.keys(doc.paths['/api/private']?.get?.responses ?? {}).sort()).toEqual(['200', '401']);
    expect(Object.keys(doc.paths['/api/things/{id}']?.get?.responses ?? {}).sort()).toEqual([
      '200',
      '401',
      '404',
    ]);
  });
});
