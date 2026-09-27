// 障害の注入。異常系のテストのため、リクエストヘッダーで遅延・エラー・タイムアウトを意図的に発生させる。
//
//   X-Fake-Delay-Ms: <ミリ秒>   応答を指定時間だけ遅らせる
//   X-Fake-Fault: error          500 を返す
//   X-Fake-Fault: unavailable    503 を返す
//   X-Fake-Fault: timeout        応答を返さない(呼び出し側のタイムアウトを発生させる)

import type { MiddlewareHandler } from 'hono';

export const MAX_DELAY_MS = 30_000;

export type Fault = 'error' | 'unavailable' | 'timeout';

export const parseFault = (value: string | undefined): Fault | undefined =>
  value === 'error' || value === 'unavailable' || value === 'timeout' ? value : undefined;

export const parseDelayMs = (value: string | undefined): number => {
  if (value === undefined) return 0;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) return 0;
  return Math.min(n, MAX_DELAY_MS);
};

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

export const faults = (): MiddlewareHandler => async (c, next) => {
  const delayMs = parseDelayMs(c.req.header('X-Fake-Delay-Ms'));
  if (delayMs > 0) await sleep(delayMs);

  switch (parseFault(c.req.header('X-Fake-Fault'))) {
    case 'error':
      return c.json({ error: 'injected_error' }, 500);
    case 'unavailable':
      return c.json({ error: 'injected_unavailable' }, 503);
    case 'timeout':
      // 応答しない。呼び出し側が中断するまで待ち続ける
      await new Promise<never>(() => undefined);
      return c.body(null);
    case undefined:
      await next();
      return;
  }
};
