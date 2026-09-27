import { expect, test } from 'vitest';

import { total } from './price';

test('a が正なら a + b を返す', () => {
  expect(total(1, 2)).toBe(3);
});

test('a が 0 なら b を返す', () => {
  expect(total(0, 2)).toBe(2);
});

test('a が負なら b を返す', () => {
  expect(total(-1, 2)).toBe(2);
});
