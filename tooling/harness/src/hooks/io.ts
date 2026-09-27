// hook の共通処理。入力は標準入力の JSON。

import { homedir } from 'node:os';

import type { PathContext } from './protected-paths.ts';

export const readInput = async (): Promise<Record<string, unknown>> => {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  const text = Buffer.concat(chunks).toString('utf8');
  return text.trim() === '' ? {} : (JSON.parse(text) as Record<string, unknown>);
};

export const pathContext = (): PathContext => ({
  projectDir: process.env['CLAUDE_PROJECT_DIR'] ?? process.cwd(),
  homeDir: homedir(),
});

export const str = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined);

/** exit code 2 でブロックし、理由を Claude に伝える */
export const block = (reason: string): never => {
  process.stderr.write(`${reason}\n`);
  process.exit(2);
};
