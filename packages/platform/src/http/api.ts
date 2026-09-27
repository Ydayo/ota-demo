// API ルートの定義と登録(ADR-0010)。
// - defineRoute: 認可ポリシーの指定を型で必須にする
// - createApi().register: 登録したルートを記録する
// - createApi().undeclaredRoutes: register を通らずに Hono へ直接登録されたルートを検出する

import {
  createRoute,
  OpenAPIHono,
  type RouteConfig,
  type RouteHandler,
} from '@hono/zod-openapi';
import type { MiddlewareHandler } from 'hono';

import { enforce, type ApiEnv, type AuthPolicy, type Session } from './policy';

type RouterRoute = OpenAPIHono<ApiEnv>['routes'][number];

export type DefinedRoute<R extends RouteConfig> = {
  readonly route: R;
  readonly policy: AuthPolicy;
};

const deniedResponses = {
  401: { description: '未ログイン' },
  404: { description: 'リソースが存在しない、または他のユーザーのリソース(ADR-0014)' },
} as const;

/**
 * 認可ポリシーつきでルートを定義する。ポリシーは省略できない。
 * ポリシーに応じた拒否レスポンス(401/404)を OpenAPI の定義に自動で加える。
 */
// hide は指定できない(OpenAPI 文書から隠すと、破壊的変更の検知をすり抜けるため。ADR-0019)
export const defineRoute = <const R extends Omit<RouteConfig, 'middleware' | 'hide'> & { readonly hide?: never }>(
  authPolicy: AuthPolicy,
  config: R,
) => {
  const denied =
    authPolicy.kind === 'public'
      ? {}
      : authPolicy.kind === 'authenticated'
        ? { 401: deniedResponses[401] }
        : deniedResponses;
  const route = createRoute({
    ...config,
    responses: { ...denied, ...config.responses },
    middleware: [enforce(authPolicy)] as const,
  });
  return { route, policy: authPolicy } satisfies DefinedRoute<typeof route>;
};

export type RegisteredRoute = {
  readonly method: string;
  readonly path: string;
  readonly policy: AuthPolicy;
};

export type Api = {
  readonly app: OpenAPIHono<ApiEnv>;
  readonly register: <R extends RouteConfig>(
    definition: DefinedRoute<R>,
    handler: RouteHandler<R, ApiEnv>,
  ) => void;
  /** register で登録したルートの一覧(認可の自動検査に使う) */
  readonly registeredRoutes: () => readonly RegisteredRoute[];
  /** register を通らずに登録されたルート。1つでもあれば起動とテストを失敗させる */
  readonly undeclaredRoutes: () => readonly { method: string; path: string }[];
};

export type CreateApiOptions = {
  readonly basePath: string;
  /** リクエストからセッションを解決する。未ログインなら null */
  readonly resolveSession: (request: Request) => Promise<Session | null>;
};

export const createApi = (options: CreateApiOptions): Api => {
  const app = new OpenAPIHono<ApiEnv>().basePath(options.basePath) as OpenAPIHono<ApiEnv>;

  const sessionMiddleware: MiddlewareHandler<ApiEnv> = async (c, next) => {
    c.set('session', await options.resolveSession(c.req.raw));
    await next();
  };
  app.use('*', sessionMiddleware);

  const declared = new Set<RouterRoute>(app.routes);
  const registered: RegisteredRoute[] = [];

  return {
    app,
    register: (definition, handler) => {
      const before = app.routes.length;
      app.openapi(definition.route, handler);
      for (const r of app.routes.slice(before)) declared.add(r);
      registered.push({
        method: definition.route.method.toUpperCase(),
        path: definition.route.path,
        policy: definition.policy,
      });
    },
    registeredRoutes: () => [...registered],
    undeclaredRoutes: () =>
      app.routes.filter((r) => !declared.has(r)).map((r) => ({ method: r.method, path: r.path })),
  };
};
