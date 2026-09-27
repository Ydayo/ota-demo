// 環境変数の検証。既定値だけでオフラインで動作する(憲法 第8条、.env.example)。

import { err, ok, type Result } from '@ota/shared';
import { z } from 'zod';

const configSchema = z.object({
  DATABASE_URL: z.url().default('postgres://ota:ota@localhost:5432/ota'),
  SMTP_HOST: z.string().min(1).default('localhost'),
  SMTP_PORT: z.coerce.number().int().min(1).max(65_535).default(1025),
  MAILPIT_API_URL: z.url().default('http://localhost:8025'),
  SUPPLIER_API_URL: z.url().default('http://localhost:4010'),
  PAYMENT_PROVIDER: z.enum(['fake', 'stripe']).default('fake'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

export type Config = z.infer<typeof configSchema>;

export type ConfigError = { readonly kind: 'invalid_config'; readonly issues: readonly string[] };

export const loadConfig = (env: Readonly<Record<string, string | undefined>>): Result<Config, ConfigError> => {
  const parsed = configSchema.safeParse(env);
  if (parsed.success) return ok(parsed.data);
  return err({
    kind: 'invalid_config',
    issues: parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
  });
};
