import { describe, expect, test } from 'vitest';

import { loadConfig } from './config';

describe('loadConfig', () => {
  test('環境変数がなくても既定値でオフライン動作できる設定になる', () => {
    const result = loadConfig({});
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.PAYMENT_PROVIDER).toBe('fake');
    expect(result.value.DATABASE_URL).toBe('postgres://ota:ota@localhost:5432/ota');
    expect(result.value.SMTP_PORT).toBe(1025);
  });

  test('環境変数の値を使う', () => {
    const result = loadConfig({ PAYMENT_PROVIDER: 'stripe', SMTP_PORT: '2525' });
    expect(result.ok && result.value.PAYMENT_PROVIDER).toBe('stripe');
    expect(result.ok && result.value.SMTP_PORT).toBe(2525);
  });

  test('不正な値はエラーとして返す', () => {
    const result = loadConfig({ PAYMENT_PROVIDER: 'paypal', SMTP_PORT: '0' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.issues).toHaveLength(2);
  });
});
