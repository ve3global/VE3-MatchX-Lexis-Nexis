import express, { type Express } from 'express';
import { activityLog } from './middleware/activityLog.js';
import { auth } from './middleware/auth.js';
import { correlationId } from './middleware/correlationId.js';
import { errorHandler } from './middleware/errorHandler.js';
import { addressLookupRouter } from './modules/addressLookup/routes.js';
import { authRouter } from './modules/auth/routes.js';
import { healthRouter } from './modules/health/routes.js';
import { notificationsRouter } from './modules/notifications/routes.js';
import { reportsRouter } from './modules/reports/routes.js';
import { reportTypesRouter } from './modules/reportTypes/routes.js';
import { scorecardsRouter } from './modules/scorecards/routes.js';
import { usersRouter } from './modules/users/routes.js';
import { webhooksRouter } from './modules/webhooks/routes.js';

export function createApp(): Express {
  const app = express();

  app.use(express.json());
  app.use(correlationId);

  // Unauthenticated routes — must be registered before the global auth
  // middleware below (LN8: exempt from bearer auth).
  app.use(healthRouter);
  app.use(authRouter);

  app.use(auth);
  app.use(activityLog);

  app.use(addressLookupRouter);
  app.use(reportTypesRouter);
  app.use(scorecardsRouter);
  app.use(reportsRouter);
  app.use(notificationsRouter);
  app.use(webhooksRouter);
  app.use(usersRouter);

  app.use(errorHandler);

  return app;
}
