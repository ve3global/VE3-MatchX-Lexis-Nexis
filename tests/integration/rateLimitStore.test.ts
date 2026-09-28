import { randomUUID } from 'node:crypto';
import type { Options } from 'express-rate-limit';
import { afterEach, describe, expect, it } from 'vitest';
import { prisma } from '../../src/lib/prisma.js';
import { PostgresRateLimitStore } from '../../src/middleware/rateLimitStore.js';

const WINDOW_MS = 500;

function createStore(): PostgresRateLimitStore {
  const store = new PostgresRateLimitStore();
  store.init({ windowMs: WINDOW_MS } as Options);
  return store;
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('PostgresRateLimitStore', () => {
  const store = createStore();
  const usedKeys: string[] = [];

  function newKey(): string {
    const key = `rate-limit-store-test-${randomUUID()}`;
    usedKeys.push(key);
    return key;
  }

  afterEach(async () => {
    await Promise.all(usedKeys.splice(0).map((key) => store.resetKey(key)));
  });

  it('counts every hit within one window', async () => {
    const key = newKey();
    await store.increment(key);
    await store.increment(key);
    const info = await store.increment(key);

    expect(info.totalHits).toBe(3);
  });

  it('carries the previous window into the weighted total, never beyond both windows combined', async () => {
    const key = newKey();
    for (let i = 0; i < 4; i++) await store.increment(key);

    // Just past the first window's end — the next contiguous window.
    await wait(WINDOW_MS + 50);
    const info = await store.increment(key);

    // Nearly a full window remains, so most of the previous 4 carry over.
    expect(info.totalHits).toBeGreaterThan(1);
    expect(info.totalHits).toBeLessThanOrEqual(1 + 4);
  });

  it('drops the previous window after an idle gap longer than one window', async () => {
    const key = newKey();
    for (let i = 0; i < 4; i++) await store.increment(key);

    await wait(WINDOW_MS * 2 + 100);
    const info = await store.increment(key);

    expect(info.totalHits).toBe(1);
  });

  it('never weights the previous window above 100%, even when reset_at is far ahead of the clock', async () => {
    // Simulates clock skew: a window end several windows in the future
    // relative to the clock the weighting is computed against. The store
    // itself never writes such a row — this is the one case only reachable
    // by seeding it directly.
    const key = newKey();
    await prisma.$executeRaw`
      INSERT INTO rate_limit_counters (client_key, count, prev_count, reset_at)
      VALUES (${key}, 2, 5, now() + interval '5 seconds');
    `;

    const info = await store.increment(key);

    // count 3 (2 + this hit) + prev_count 5 weighted at exactly 100% —
    // not 3 + 5 * ~10 as an unclamped fraction would give.
    expect(info.totalHits).toBe(3 + 5);
  });

  it('reports the true window end regardless of the DB session time zone', async () => {
    // A session far from UTC (UTC+14). Run inside a transaction so SET LOCAL
    // scopes the zone to this one connection and the row rolls back after.
    const ROLLBACK = new Error('rollback');
    let resetTime: Date | undefined;
    await prisma
      .$transaction(async (tx) => {
        await tx.$executeRaw`SET LOCAL TimeZone = 'Pacific/Kiritimati'`;
        const zonedStore = new PostgresRateLimitStore(tx);
        zonedStore.init({ windowMs: WINDOW_MS } as Options);
        resetTime = (await zonedStore.increment(newKey())).resetTime;
        throw ROLLBACK;
      })
      .catch((error: unknown) => {
        if (error !== ROLLBACK) throw error;
      });

    // Within a second of now — not 14 hours off.
    expect(Math.abs(resetTime!.getTime() - Date.now())).toBeLessThan(1000);
  });
});
