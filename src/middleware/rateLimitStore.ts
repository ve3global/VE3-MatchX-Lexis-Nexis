import type { ClientRateLimitInfo, Options, Store } from 'express-rate-limit';
import { prisma } from '../lib/prisma.js';

/**
 * Sliding-window-counter rate-limit store backed by the shared Postgres DB,
 * instead of express-rate-limit's default in-process MemoryStore. Production
 * runs multiple pods behind an EKS HPA — an in-memory store gives each pod
 * its own independent counter, so a client's requests spread across pods
 * never add up to the configured limit on any single pod. This store makes
 * the count visible to (and atomically shared across) every pod.
 *
 * A plain fixed window (reset the count to 0 every windowMs) lets a client
 * burst up to ~2x the limit across a window boundary: e.g. 10 requests just
 * before the window rolls over plus 10 more just after, all within about a
 * second of wall-clock time. To close that gap, each row also keeps the
 * *previous* window's final count, and totalHits is a weighted blend of the
 * two windows — weighted by how much of the current window has elapsed —
 * approximating a true rolling window without needing a per-request log.
 *
 * The insert/update is a single statement so concurrent requests for the
 * same key across pods can't race: whichever request's row lands second
 * still sees the first's write via Postgres's row-level locking on the
 * upsert.
 */
export class PostgresRateLimitStore implements Store {
  private windowMs = 1000;

  init(options: Options): void {
    this.windowMs = options.windowMs;
  }

  async increment(key: string): Promise<ClientRateLimitInfo> {
    const rows = await prisma.$queryRaw<
      Array<{ count: number; prev_count: number; reset_at: Date }>
    >`
      INSERT INTO rate_limit_counters AS c (client_key, count, prev_count, reset_at)
      VALUES (${key}, 1, 0, now() + (${this.windowMs} || ' milliseconds')::interval)
      ON CONFLICT (client_key) DO UPDATE SET
        count = CASE WHEN c.reset_at <= now() THEN 1 ELSE c.count + 1 END,
        -- Only carry the closed window's count forward as prev_count when
        -- that window ended less than one windowMs ago (i.e. this is truly
        -- the next contiguous window). A client that's been idle longer than
        -- that has no meaningful "previous window" — carrying an old count
        -- forward across an idle gap would wrongly throttle its next burst.
        prev_count = CASE
          WHEN c.reset_at <= now() AND c.reset_at > now() - (${this.windowMs} || ' milliseconds')::interval THEN c.count
          WHEN c.reset_at <= now() THEN 0
          ELSE c.prev_count
        END,
        reset_at = CASE WHEN c.reset_at <= now() THEN now() + (${this.windowMs} || ' milliseconds')::interval ELSE c.reset_at END
      RETURNING count, prev_count, reset_at;
    `;
    const row = rows[0]!;
    const fractionRemaining = Math.max(0, (row.reset_at.getTime() - Date.now()) / this.windowMs);
    const weighted = row.count + Math.floor(row.prev_count * fractionRemaining);
    return { totalHits: weighted, resetTime: row.reset_at };
  }

  async decrement(key: string): Promise<void> {
    await prisma.$executeRaw`
      UPDATE rate_limit_counters SET count = GREATEST(count - 1, 0) WHERE client_key = ${key};
    `;
  }

  async resetKey(key: string): Promise<void> {
    await prisma.$executeRaw`DELETE FROM rate_limit_counters WHERE client_key = ${key};`;
  }
}
