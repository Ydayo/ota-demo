import { serve } from '@hono/node-server';

import { createApp } from './app.ts';

const port = Number(process.env['PORT'] ?? '4010');

const server = serve({ fetch: createApp().fetch, port }, (info) => {
  console.log(`fake-supplier listening on http://localhost:${String(info.port)}`);
});

const shutdown = (): void => {
  server.close();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
