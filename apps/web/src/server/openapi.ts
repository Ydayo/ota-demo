// OpenAPI 文書の生成。apps/web/openapi.json にコミットし、CI で破壊的変更を検知する(oasdiff。ADR-0012)。

import type { Api } from '@ota/platform';

export const openApiDocument = (api: Api) =>
  api.app.getOpenAPI31Document({
    openapi: '3.1.0',
    info: { title: 'OTA デモ API', version: '0.0.0' },
  });
