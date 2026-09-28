import { randomUUID } from 'node:crypto';
import express, { type Express } from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { prisma } from '../../src/lib/prisma.js';
import { createRateLimiter } from '../../src/middleware/rateLimiter.js';

/**
 * A minimal app rather than createApp(): the default `rateLimiter` export is
 * skipped under NODE_ENV=test, so this builds its own unskipped limiter via
 * the factory. The stand-in for `auth` sets a fresh `req.client` per test so
 * each test gets its own counter row in the real Postgres store.
 */
function buildApp(clientId: string, options: Parameters<typeof createRateLimiter>[0]): Express {
  const app = express();
  app.use((req, _res, next) => {
    req.client = { id: clientId, clientId, name: 'rate-limiter-test' };
    next();
  });
  app.use(createRateLimiter(options));
  app.get('/ping', (_req, res) => {
    res.json({ ok: true });
  });
  return app;
}

describe('rate limiter', () => {
  const usedClientIds: string[] = [];

  function newClientId(): string {
    const id = `rate-limiter-test-${randomUUID()}`;
    usedClientIds.push(id);
    return id;
  }

  afterEach(async () => {
    const ids = usedClientIds.splice(0);
    await prisma.rateLimitCounter.deleteMany({ where: { key: { in: ids } } });
  });

  it('lets requests under the limit through and rejects the next one with the existing 429', async () => {
    const app = buildApp(newClientId(), { limit: 3, skip: () => false });

    for (let i = 0; i < 3; i++) {
      const ok = await request(app).get('/ping');
      expect(ok.status).toBe(200);
    }
    const res = await request(app).get('/ping');

    expect(res.status).toBe(429);
    expect(res.headers['retry-after']).toBe('1');
    expect(res.body).toEqual({
      message: 'Too many requests — rate limit exceeded for this client.',
      retry_after_seconds: 1,
    });
  });

  it('lets every request through when its skip predicate is true (how THROTTLE_MODE=run disables it)', async () => {
    const app = buildApp(newClientId(), { limit: 3, skip: () => true });

    const statuses = await Promise.all(
      Array.from({ length: 10 }, async () => (await request(app).get('/ping')).status),
    );

    expect(statuses.every((status) => status === 200)).toBe(true);
  });
});
