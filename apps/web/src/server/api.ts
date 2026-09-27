// API の組み立て(コンポジションルート)。すべてのルートはここで register する。

import { createApi, type Api, type Session } from '@ota/platform';

import { registerHealth, type HealthDeps } from './routes/health';

export type ApiDeps = HealthDeps & {
  readonly resolveSession: (request: Request) => Promise<Session | null>;
};

export const buildApi = (deps: ApiDeps): Api => {
  const api = createApi({ basePath: '/api', resolveSession: deps.resolveSession });
  registerHealth(api, deps);

  // 認可ポリシーを宣言していないルートがあれば起動させない(ADR-0010)
  const undeclared = api.undeclaredRoutes();
  if (undeclared.length > 0) {
    const list = undeclared.map((r) => `${r.method} ${r.path}`).join(', ');
    throw new Error(
      `認可ポリシーを宣言していないルートがあります: ${list}(docs/adr/0010-authorization-policy-declaration.md)`,
    );
  }
  return api;
};
