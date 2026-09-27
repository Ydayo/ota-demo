// 疑似サプライヤー API。外部サプライヤーを模し、腐敗防止層のアダプター越しに呼ばれる(CONTEXT-MAP.md)。
// 業務のエンドポイントはフェーズ2で仕様に基づいて追加する。

import { Hono } from 'hono';

import { faults } from './faults.ts';

export const createApp = (): Hono => {
  const app = new Hono();

  app.get('/health', (c) => c.json({ status: 'ok' }));

  // /v1 以下のすべてのエンドポイントに障害の注入を適用する
  app.use('/v1/*', faults());
  app.get('/v1/ping', (c) => c.json({ pong: true }));

  return app;
};
