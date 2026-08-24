import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env.js';

const HEADER = 'x-ln-replica-force-status';

/**
 * Replica-only extension (see README.md) — lets a caller force this specific
 * request to fail with a chosen 5xx, to test their own client's error
 * handling against something other than a real outage. Distinct from a QA
 * override value (see CONTEXT.md): this forces the transport-level response
 * itself, regardless of the request's business data.
 *
 * Mounted before `auth` (see app.ts) so it applies to every route, including
 * `/up` and `/oauth/token` — the two routes everything else in the chain
 * exempts. Trade-off: a forced fault never reaches `auth`, so it never sets
 * `req.client`, which means `activityLog` never records it and `rateLimiter`
 * never counts it. Accepted in exchange for firing on every route.
 *
 * Fails open: an absent/malformed/unsupported header value, or
 * FAULT_INJECTION_ENABLED=false, is treated identically — the request
 * proceeds normally.
 */
const MESSAGES: Record<number, string> = {
  500: 'Internal server error',
  502: 'Bad gateway',
  503: 'Service unavailable',
  504: 'Gateway timeout',
};

export function faultInjection(req: Request, res: Response, next: NextFunction): void {
  if (!env.faultInjectionEnabled) {
    next();
    return;
  }

  const status = Number(req.header(HEADER));
  const message = MESSAGES[status];
  if (!message) {
    next();
    return;
  }

  res.status(status).json({
    message,
    correlationId: req.correlationId,
    injected: true,
  });
}
