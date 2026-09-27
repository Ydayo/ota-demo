import { fc, it } from '@fast-check/vitest';
import { describe, expect, test } from 'vitest';

import { andThen, err, map, mapErr, ok, type Result } from './result';

// 宣言型が Result でも代入で Ok / Err に絞り込まれるため、戻り値の型で Result に固定する
const success = (value: number): Result<number, string> => ok(value);
const failure = (error: string): Result<number, string> => err(error);

const arbResult = fc.oneof(fc.integer().map(success), fc.string().map(failure));

describe('Result', () => {
  test('ok は値を保持する', () => {
    expect(ok(1)).toEqual({ ok: true, value: 1 });
  });

  test('err はエラーを保持する', () => {
    expect(err('e')).toEqual({ ok: false, error: 'e' });
  });

  it.prop([arbResult])('map に恒等関数を渡しても変わらない', (r) => {
    expect(map(r, (v) => v)).toEqual(r);
  });

  it.prop([fc.integer()])('map は ok の値に関数を適用する', (v) => {
    expect(map(ok(v), (x) => x + 1)).toEqual(ok(v + 1));
  });

  it.prop([fc.string()])('map は err をそのまま返す', (e) => {
    const r = failure(e);
    expect(map(r, (x) => x + 1)).toEqual(err(e));
  });

  it.prop([fc.string()])('mapErr は err のエラーに関数を適用する', (e) => {
    const r = failure(e);
    expect(mapErr(r, (x) => `${x}!`)).toEqual(err(`${e}!`));
  });

  it.prop([fc.integer()])('mapErr は ok をそのまま返す', (v) => {
    const r = success(v);
    expect(mapErr(r, (x) => `${x}!`)).toEqual(ok(v));
  });

  it.prop([fc.integer()])('andThen は ok の値で次の処理を呼ぶ', (v) => {
    expect(andThen(success(v), (x) => (x >= 0 ? ok(x) : err('negative')))).toEqual(
      v >= 0 ? ok(v) : err('negative'),
    );
  });

  it.prop([fc.string()])('andThen は err のとき次の処理を呼ばない', (e) => {
    const r = failure(e);
    let called = false;
    const next = (x: number): Result<number, string> => {
      called = true;
      return ok(x);
    };
    expect(andThen(r, next)).toEqual(err(e));
    expect(called).toBe(false);
  });
});
