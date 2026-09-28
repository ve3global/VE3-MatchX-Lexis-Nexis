/**
 * Pure parsers for the rate limiter's env config (see rateLimiter.ts). They
 * never throw: an unset value silently falls back to the default, and an
 * invalid one falls back with a warning — a typo in deployment config must
 * never disable throttling or stop the app from starting. `warn` is
 * injectable so tests can assert on it without console noise.
 */

export const DEFAULT_RATE_LIMIT_PER_SECOND = 10;

function configWarning(name: string, raw: string, fallback: string | number): string {
  return JSON.stringify({
    type: 'config',
    level: 'warn',
    message: `Invalid ${name} ${JSON.stringify(raw)} — falling back to ${fallback}`,
    timestamp: new Date().toISOString(),
  });
}

export function parseRateLimit(
  raw: string | undefined,
  warn: (message: string) => void = console.warn,
): number {
  const trimmed = raw?.trim();
  if (!trimmed) return DEFAULT_RATE_LIMIT_PER_SECOND;
  // Plain decimal digits only — Number() alone would also accept `1e1`/`0x10`.
  const value = /^\d+$/.test(trimmed) ? Number(trimmed) : NaN;
  if (!Number.isSafeInteger(value) || value <= 0) {
    warn(configWarning('RATE_LIMIT_PER_SECOND', trimmed, DEFAULT_RATE_LIMIT_PER_SECOND));
    return DEFAULT_RATE_LIMIT_PER_SECOND;
  }
  return value;
}

/**
 * `limiter` (the fallback — the primary use) applies the real rate limiter;
 * `run` bypasses it entirely so a deployment's only 429s are run-fabricated
 * ones (see src/middleware/runInjection.ts). Deployment config only — never
 * a request header, so a caller can't opt itself out of rate limiting.
 */
export type ThrottleMode = 'limiter' | 'run';

export const DEFAULT_THROTTLE_MODE: ThrottleMode = 'limiter';

export function parseThrottleMode(
  raw: string | undefined,
  warn: (message: string) => void = console.warn,
): ThrottleMode {
  const value = raw?.trim().toLowerCase();
  if (!value) return DEFAULT_THROTTLE_MODE;
  if (value === 'limiter' || value === 'run') return value;
  warn(configWarning('THROTTLE_MODE', raw!, DEFAULT_THROTTLE_MODE));
  return DEFAULT_THROTTLE_MODE;
}
