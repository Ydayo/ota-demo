// axe の検査の自己テスト。違反のあるページで違反を検出できること(検査が常に緑にならないこと)を確かめる。

import { expect, test } from '@playwright/test';

import { axe } from './axe';

test('axe は WCAG 2.2 AA の違反を検出できる', async ({ page }) => {
  await page.setContent('<html><body><img src="x.png"><button></button></body></html>');
  const results = await axe(page).analyze();
  expect(results.violations.map((v) => v.id)).toEqual(
    expect.arrayContaining(['html-has-lang', 'image-alt', 'button-name']),
  );
});
