import { fc, it } from '@fast-check/vitest';
import { describe, expect, test } from 'vitest';

import { createApp } from './app.ts';
import { MAX_DELAY_MS, parseDelayMs, parseFault } from './faults.ts';

describe('fake-supplier', () => {
  const app = createApp();

  test('/health は 200 を返す', async () => {
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok' });
  });

  test('障害を指定しなければ正常に応答する', async () => {
    const res = await app.request('/v1/ping');
    expect(res.status).toBe(200);
  });

  test('X-Fake-Fault: error で 500 を返す', async () => {
    const res = await app.request('/v1/ping', { headers: { 'X-Fake-Fault': 'error' } });
    expect(res.status).toBe(500);
  });

  test('X-Fake-Fault: unavailable で 503 を返す', async () => {
    const res = await app.request('/v1/ping', { headers: { 'X-Fake-Fault': 'unavailable' } });
    expect(res.status).toBe(503);
  });

  test('X-Fake-Fault: timeout では応答しない', async () => {
    const res = Promise.resolve(app.request('/v1/ping', { headers: { 'X-Fake-Fault': 'timeout' } }));
    const winner = await Promise.race([
      res.then(() => 'responded'),
      new Promise((resolve) => setTimeout(() => { resolve('pending'); }, 100)),
    ]);
    expect(winner).toBe('pending');
  });

  test('X-Fake-Delay-Ms で応答が遅れる', async () => {
    const started = Date.now();
    const res = await app.request('/v1/ping', { headers: { 'X-Fake-Delay-Ms': '50' } });
    expect(res.status).toBe(200);
    expect(Date.now() - started).toBeGreaterThanOrEqual(45);
  });

  test('/health には障害を注入しない', async () => {
    const res = await app.request('/health', { headers: { 'X-Fake-Fault': 'error' } });
    expect(res.status).toBe(200);
  });
});

describe('障害ヘッダーの解釈', () => {
  test('未知の障害名は無視する', () => {
    expect(parseFault('unknown')).toBeUndefined();
    expect(parseFault(undefined)).toBeUndefined();
  });

  it.prop([fc.integer({ min: 0, max: MAX_DELAY_MS })])('範囲内の遅延はそのまま使う', (ms) => {
    expect(parseDelayMs(String(ms))).toBe(ms);
  });

  it.prop([fc.integer({ min: MAX_DELAY_MS + 1 })])('上限を超える遅延は上限に丸める', (ms) => {
    expect(parseDelayMs(String(ms))).toBe(MAX_DELAY_MS);
  });

  it.prop([fc.integer({ max: -1 })])('負の遅延は 0 とみなす', (ms) => {
    expect(parseDelayMs(String(ms))).toBe(0);
  });

  test('数値でない遅延は 0 とみなす', () => {
    expect(parseDelayMs('abc')).toBe(0);
    expect(parseDelayMs('1.5')).toBe(0);
    expect(parseDelayMs(undefined)).toBe(0);
  });
});
