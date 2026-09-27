// 実行時の依存の組み立て。環境変数を検証し、DB などの接続を1つだけ作る。

import 'server-only';

import { createDatabase, loadConfig, type Api } from '@ota/platform';

import { buildApi } from './api';

let api: Api | undefined;

export const getApi = (): Api => {
  if (api !== undefined) return api;

  const config = loadConfig(process.env);
  if (!config.ok) {
    throw new Error(`環境変数が不正です: ${config.error.issues.join('; ')}`);
  }
  const database = createDatabase(config.value.DATABASE_URL);

  api = buildApi({
    pingDatabase: database.ping,
    // 認証(Better Auth)はフェーズ2で組み込む。それまでは常に未ログイン
    resolveSession: () => Promise.resolve(null),
  });
  return api;
};
