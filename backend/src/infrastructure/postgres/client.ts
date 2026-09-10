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
});
