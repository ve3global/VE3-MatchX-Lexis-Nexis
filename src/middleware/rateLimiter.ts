import rateLimit from 'express-rate-limit';
import { PostgresRateLimitStore } from './rateLimitStore.js';

/**
 * Replica-only extension (see README.md) — the real IDU doc never
 * documents a general API rate limit (the only 429 it mentions at all is
 * on the remote-check *resend* endpoint specifically, unrelated to this).
 * Added for demo purposes: 10 requests/second per client, fixed window.
 * Mounted after `auth` (see app.ts), so `req.client` is always set here —
 * `/up` and `/oauth/token` are registered before `auth` and stay exempt,
 * same as they already are for bearer auth itself.
 *
 * Uses a Postgres-backed store (see rateLimitStore.ts), not the library's
 * default in-memory store — production runs multiple pods behind an EKS
 * HPA, and per-pod in-memory counters never see a client's full request
 * rate, so the limit silently never triggers.
 *
 * Skipped under `NODE_ENV=test` (set automatically by Vitest) so the
 * automated suite's rapid-fire integration tests aren't throttled.
 */
export const rateLimiter = rateLimit({
  windowMs: 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  store: new PostgresRateLimitStore(),
  skip: () => process.env.NODE_ENV === 'test',
  keyGenerator: (req) => req.client!.id,
  handler: (_req, res) => {
    res.set('Retry-After', '1').status(429).json({
      message: 'Too many requests — rate limit exceeded for this client.',
      retry_after_seconds: 1,
    });
  },
});
