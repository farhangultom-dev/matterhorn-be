import express, { type Express } from 'express';
import routes from './routes';
import { errorHandler } from './middlewares/error.middleware';
import { notFound } from './middlewares/not-found.middleware';

export const createApp = (): Express => {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '16kb' }));
  app.use(routes);
  app.use(notFound);
  app.use(errorHandler);
  return app;
};

const app = createApp();

export default app;