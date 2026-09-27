// 認可ポリシー(ADR-0010)。すべての API ルートは、このいずれかを宣言しなければならない。

import type { Context, MiddlewareHandler } from 'hono';

export type Session = { readonly userId: string };

export type ApiEnv = { Variables: { session: Session | null } };

export type AuthPolicy =
  | { readonly kind: 'public' }
  | { readonly kind: 'authenticated' }
  | {
      readonly kind: 'owner';
      /** リソースの所有者の userId を返す。リソースが存在しなければ null */
      readonly ownerOf: (c: Context<ApiEnv>) => Promise<string | null>;
    };

export const policy = {
  public: { kind: 'public' },
  authenticated: { kind: 'authenticated' },
  owner: (ownerOf: (c: Context<ApiEnv>) => Promise<string | null>): AuthPolicy => ({
    kind: 'owner',
    ownerOf,
  }),
} as const satisfies Record<string, AuthPolicy | ((...args: never[]) => AuthPolicy)>;

export const enforce =
  (authPolicy: AuthPolicy): MiddlewareHandler<ApiEnv> =>
  async (c, next) => {
    if (authPolicy.kind === 'public') {
      await next();
      return;
    }
    const session = c.get('session');
    if (session === null) return c.json({ error: 'unauthenticated' }, 401);
    if (authPolicy.kind === 'owner') {
      const ownerId = await authPolicy.ownerOf(c);
      // 他のユーザーのリソースは、存在しないリソースと区別せず 404 を返す(ADR-0014)
      if (ownerId === null || ownerId !== session.userId) return c.json({ error: 'not_found' }, 404);
    }
    await next();
    return;
  };
