// 構造化ログ。

import { pino, type Logger } from 'pino';

import type { Config } from './config';

export type { Logger };

export const createLogger = (config: Pick<Config, 'LOG_LEVEL'>): Logger =>
  pino({ level: config.LOG_LEVEL });
