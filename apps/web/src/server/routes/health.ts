import { defineRoute, policy, z, type Api } from '@ota/platform';

const HealthSchema = z.object({
  status: z.enum(['ok', 'degraded']),
  database: z.enum(['ok', 'unavailable']),
});

export const healthRoute = defineRoute(policy.public, {
  method: 'get',
  path: '/health',
  responses: {
    200: { description: '正常', content: { 'application/json': { schema: HealthSchema } } },
    503: { description: '依存先に到達できない', content: { 'application/json': { schema: HealthSchema } } },
  },
});

export type HealthDeps = { readonly pingDatabase: () => Promise<void> };

export const registerHealth = (api: Api, deps: HealthDeps): void => {
  api.register(healthRoute, async (c) => {
    try {
      await deps.pingDatabase();
      return c.json({ status: 'ok', database: 'ok' } as const, 200);
    } catch {
      return c.json({ status: 'degraded', database: 'unavailable' } as const, 503);
    }
  });
};
