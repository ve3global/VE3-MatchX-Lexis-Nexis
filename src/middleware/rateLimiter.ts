import rateLimit from 'express-rate-limit';
import { parseRateLimit, parseThrottleMode } from '../lib/rateLimitConfig.js';
import { PostgresRateLimitStore } from './rateLimitStore.js';

/**
 * Replica-only extension (see README.md) — the real IDU doc never
 * documents a general API rate limit (the only 429 it mentions at all is
 * on the remote-check *resend* endpoint specifically, unrelated to this).
 * Added for demo purposes: a per-client limit per second (sliding window,
 * see rateLimitStore.ts). Mounted after `auth` (see app.ts), so `req.client`
 * is always set here — `/up` and `/oauth/token` are registered before `auth`
 * and stay exempt, same as they already are for bearer auth itself.
 *
 * Uses a Postgres-backed store (see rateLimitStore.ts), not the library's
 * default in-memory store — production runs multiple pods behind an EKS
 * HPA, and per-pod in-memory counters never see a client's full request
 * rate, so the limit silently never triggers.
 */
export function createRateLimiter(options: { limit: number; skip: () => boolean }) {
  return rateLimit({
    windowMs: 1000,
    limit: options.limit,
    standardHeaders: true,
    legacyHeaders: false,
    store: new PostgresRateLimitStore(),
    skip: options.skip,
    keyGenerator: (req) => req.client!.id,
    handler: (_req, res) => {
      res.set('Retry-After', '1').status(429).json({
        message: 'Too many requests — rate limit exceeded for this client.',
        retry_after_seconds: 1,
      });
    },
  });
}

// Read via process.env directly rather than the shared `env` config object,
// for the same reason faultInjection.ts does: that object eagerly requires
// DATABASE_URL, and this module is in app.ts's import graph, which the
// no-DB doc-parity test imports without it. Unlike faultInjection.ts, both
// are read once at startup (a change needs a restart) so an invalid value
// warns once, not per request. Both fall back to their defaults (10 req/s,
// `limiter`) when unset or invalid — see lib/rateLimitConfig.ts.
const limit = parseRateLimit(process.env.RATE_LIMIT_PER_SECOND);
const throttleMode = parseThrottleMode(process.env.THROTTLE_MODE);

/**
 * Skipped under `NODE_ENV=test` (set automatically by Vitest) so the
 * automated suite's rapid-fire integration tests aren't throttled, and under
 * `THROTTLE_MODE=run`, where a deployment's only 429s are the ones
 * simulation runs fabricate (see runInjection.ts).
 */
export const rateLimiter = createRateLimiter({
  limit,
  skip: () => process.env.NODE_ENV === 'test' || throttleMode === 'run',
});
