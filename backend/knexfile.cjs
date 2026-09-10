/* eslint-disable @typescript-eslint/no-require-imports */
/* global require, module, process */

const { resolve } = require('node:path');

require('dotenv').config({ path: resolve(process.cwd(), '../.env') });

module.exports = {
  development: {
    client: 'pg',
    connection: {
      host: process.env.POSTGRES_HOST || 'localhost',
      port: Number(process.env.POSTGRES_PORT || 5432),
      database: process.env.POSTGRES_DB || 'notification_engine',
      user: process.env.POSTGRES_USER || 'notification_user',
      password: process.env.POSTGRES_PASSWORD || 'change_me',
    },
    migrations: {
      directory: './migrations',
    },
  },
};
