// アプリ全体の起動と、アクセシビリティの基本の検査(ADR-0019)。
// 要件ごとの振る舞いは受け入れテスト(tests/acceptance/)で検証する。

import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

// WCAG 2.2 AA の検査に必要なタグ(axe-core のルールには、導入された版のタグだけが付いている)
const WCAG_22_AA = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

test('トップページにデモサイトの注意書きが表示される', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'OTA デモ' })).toBeVisible();
  await expect(page.getByRole('note', { name: 'デモサイトの注意' })).toContainText('実際の予約・決済は行われません');
});

test('トップページに WCAG 2.2 AA の違反がない', async ({ page }) => {
  await page.goto('/');
  const results = await new AxeBuilder({ page }).withTags(WCAG_22_AA).analyze();
  expect(results.violations).toEqual([]);
});

test('API のヘルスチェックが DB に到達できる(実行時の依存の組み立て)', async ({ request }) => {
  const res = await request.get('/api/health');
  expect(res.status()).toBe(200);
  expect(await res.json()).toEqual({ status: 'ok', database: 'ok' });
});
