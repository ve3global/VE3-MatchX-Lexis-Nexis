import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';

/**
 * EPIC-11: writes one `ActivityLog` row per authenticated request,
 * capturing the final status code after the response is sent —
 * `application`/`level`/`channel`/`server_name`/`path_identifier` have
 * no confirmed source in this replica (nothing generates them), so
 * they're left `null` rather than fabricated (see
 * planning/specs/epic-11-users-module/plan.md). Mounted after `auth` —
 * unauthenticated requests (no `req.client`) are never logged, since
 * there's no client to attribute the row to.
 */
export function activityLog(req: Request, res: Response, next: NextFunction): void {
  res.on('finish', () => {
    if (!req.client) {
      return;
    }
    // Fire-and-forget — a logging failure must never surface to the caller.
    prisma.activityLog
      .create({
        data: {
          clientId: req.client.id,
          method: req.method,
          path: req.route?.path ?? req.path,
          ip: req.ip,
          status: res.statusCode,
        },
      })
      .catch((error: unknown) => {
        console.error(JSON.stringify({ event: 'activity_log_write_failed', error: String(error) }));
      });
  });
  next();
}
