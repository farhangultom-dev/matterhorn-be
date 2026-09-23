import { createServer } from 'node:http';
import { createApp } from './app';
import { getAppEnv, getDatabaseEnv, getAuthEnv, getSmtpEnv } from './config/env';
import { getDatabase, destroyDatabase } from './config/database';
import { closeMailTransporter } from './config/mail';

const startServer = async (): Promise<void> => {
  const appEnv = getAppEnv();
  getAuthEnv();
  getSmtpEnv();
  getDatabaseEnv();
  await getDatabase().raw('select 1');
  const server = createServer(createApp());
  let isShuttingDown = false;
  const shutdown = async (): Promise<void> => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    await new Promise<void>((resolve) => server.close(() => resolve()));
    closeMailTransporter();
    await destroyDatabase();
  };
  process.once('SIGINT', () => void shutdown().finally(() => process.exit(0)));
  process.once('SIGTERM', () => void shutdown().finally(() => process.exit(0)));
  server.listen(appEnv.port, () => console.log(`Matterhorn API listening on port ${appEnv.port}`));
};

startServer().catch(async (error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Unable to start server');
  await destroyDatabase();
  process.exitCode = 1;
});
