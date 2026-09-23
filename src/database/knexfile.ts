import path from 'node:path';
import type { Knex } from 'knex';
import { getDatabaseEnv } from '../config/env';

const env = getDatabaseEnv();
const config: Knex.Config = {
  client: 'pg',
  connection: { host: env.host, port: env.port, database: env.database, user: env.user, password: env.password },
  pool: { min: 0, max: 10 },
  acquireConnectionTimeout: 3000,
  migrations: { directory: path.join(__dirname, 'migrations'), loadExtensions: ['.js'], tableName: 'knex_migrations' },
  seeds: { directory: path.join(__dirname, 'seeds'), loadExtensions: ['.js'] },
};

export = config;
