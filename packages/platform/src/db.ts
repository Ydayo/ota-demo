// DB 接続(Drizzle ORM + node-postgres)。テーブル定義は各モジュールの infrastructure/db/ が持つ(ADR-0004)。

import { sql } from 'drizzle-orm';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

export type Database = {
  readonly db: NodePgDatabase;
  /** DB に到達できるかを確かめる */
  readonly ping: () => Promise<void>;
  readonly close: () => Promise<void>;
};

export const createDatabase = (connectionString: string): Database => {
  const pool = new Pool({ connectionString });
  const db = drizzle(pool);
  return {
    db,
    ping: async () => {
      await db.execute(sql`select 1`);
    },
    close: () => pool.end(),
  };
};
