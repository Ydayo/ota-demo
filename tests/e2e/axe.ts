// アクセシビリティの検査(axe。ADR-0019)の共通設定。E2E のすべての検査でこれを使う。

import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';

// WCAG 2.2 AA の検査に必要なタグ(axe-core のルールには、導入された版のタグだけが付いている)
const WCAG_22_AA = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

export const axe = (page: Page): AxeBuilder => new AxeBuilder({ page }).withTags(WCAG_22_AA);
