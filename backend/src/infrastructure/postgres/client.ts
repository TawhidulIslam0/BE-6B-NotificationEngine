import { resolve } from 'node:path';

import dotenv from 'dotenv';
import knex from 'knex';

dotenv.config({ path: resolve(process.cwd(), '../.env') });

export const database = knex({
  client: 'pg',
  connection: {
    host: process.env.POSTGRES_HOST ?? 'localhost',
    port: Number(process.env.POSTGRES_PORT ?? 5432),
    database: process.env.POSTGRES_DB ?? 'notification_engine',
    user: process.env.POSTGRES_USER ?? 'notification_user',
    password: process.env.POSTGRES_PASSWORD ?? 'change_me',
  },
  pool: {
    min: Number(process.env.POSTGRES_POOL_MIN ?? 2),
    max: Number(process.env.POSTGRES_POOL_MAX ?? 10),
    idleTimeoutMillis: Number(
      process.env.POSTGRES_POOL_IDLE_TIMEOUT_MS ?? 30_000,
    ),
    acquireTimeoutMillis: Number(
      process.env.POSTGRES_POOL_ACQUIRE_TIMEOUT_MS ?? 10_000,
    ),
  },
});
