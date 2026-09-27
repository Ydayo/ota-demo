// 結合テスト: Testcontainers で実際の PostgreSQL を起動する。

import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import { createDatabase, type Database } from './db';

describe('createDatabase(PostgreSQL 18)', () => {
  let container: StartedPostgreSqlContainer;
  let database: Database;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:18.6').start();
    database = createDatabase(container.getConnectionUri());
  });

  afterAll(async () => {
    await database.close();
    await container.stop();
  });

  test('DB に接続できる', async () => {
    await expect(database.ping()).resolves.toBeUndefined();
  });
});
