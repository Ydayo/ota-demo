import { expect, test } from 'vitest';

import { total } from './price';

test('合計を返す', () => {
  expect(total(1, 2)).toBeTypeOf('number');
});
