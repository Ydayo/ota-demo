// 共有カーネルの公開窓口(ADR-0002、ADR-0011)。外部への依存は禁止(ADR-0004 shared-pure)。
export type { Err, Ok, Result } from './src/result';
export { andThen, err, map, mapErr, ok } from './src/result';
