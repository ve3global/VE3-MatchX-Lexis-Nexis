import express, { Router, type Express } from 'express';
import { API_PREFIX } from './lib/apiPrefix.js';
import { activityLog } from './middleware/activityLog.js';
import { auth } from './middleware/auth.js';
import { correlationId } from './middleware/correlationId.js';
import { errorHandler } from './middleware/errorHandler.js';
import { rateLimiter } from './middleware/rateLimiter.js';
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

  // The one deliberate exception to API_PREFIX — k8s readiness/liveness
  // probes hit this directly on the pod, bypassing the ingress that
  // otherwise requires the prefix (see lib/apiPrefix.ts).
  app.use(healthRouter);

  const api = Router();

  // Unauthenticated routes — must be registered before the global auth
  // middleware below (LN8: exempt from bearer auth).
  api.use(authRouter);

  api.use(auth);
  api.use(activityLog);
  api.use(rateLimiter);

  api.use(addressLookupRouter);
  api.use(reportTypesRouter);
  api.use(scorecardsRouter);
  api.use(reportsRouter);
  api.use(notificationsRouter);
  api.use(webhooksRouter);
  api.use(usersRouter);

  app.use(API_PREFIX, api);

  app.use(errorHandler);

  return app;
}
