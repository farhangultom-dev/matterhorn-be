import knex, { Knex } from 'knex';
import { getDatabaseEnv } from './env';

let database: Knex | undefined;

export const getDatabase = (): Knex => {
  if (!database) {
    const env = getDatabaseEnv();
    database = knex({
      client: 'pg',
      connection: { host: env.host, port: env.port, database: env.database, user: env.user, password: env.password },
      pool: { min: 0, max: 10 },
      acquireConnectionTimeout: 3000,
    });
  }
  return database;
};

export const destroyDatabase = async (): Promise<void> => {
  if (database) {
    await database.destroy();
    database = undefined;
  }
};
