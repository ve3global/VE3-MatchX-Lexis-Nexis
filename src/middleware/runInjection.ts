import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { pickOutcome, type DistributionEntry } from '../lib/runDistribution.js';

const RUN_ID_HEADER = 'x-ln-replica-run-id';

/** Same fixed per-code messages fault injection already uses (src/middleware/faultInjection.ts). */
const FAULT_MESSAGES: Record<number, string> = {
  500: 'Internal server error',
  502: 'Bad gateway',
  503: 'Service unavailable',
  504: 'Gateway timeout',
};

/**
 * A plain insert into the append-only RunEvent log — never an UPDATE on a
 * shared counter row, so concurrent requests under the same run have
 * nothing to contend on (see prisma/schema.prisma's RunEvent comment).
 * GET /runs/{id} (src/modules/runs/service.ts) aggregates these into a
 * tally via COUNT/GROUP BY at read time.
 */
async function recordEvent(runId: string, status: number): Promise<void> {
  await prisma.runEvent.create({ data: { runId, status } });
}

/**
 * Replica-only extension (see constitution.md, CONTEXT.md's "Run" entry,
 * .scratch/run-simulation/spec.md) — no LN doc equivalent. Distinct from
 * fault injection: this spans many requests across any endpoint for as long
 * as a run stays active, rather than exactly one request, and it can
 * fabricate 422/429 as well as 5xx.
 *
 * Mounted after `auth` (needs `req.client` to enforce per-client run
 * ownership — unlike fault injection, which runs before `auth`) and before
 * `activityLog`/`rateLimiter` and every business router (see app.ts), so a
 * fabricated 422/429/5xx outcome bypasses both entirely. A `200` roll calls
 * `next()` and proceeds through the real chain, including the real rate
 * limiter, completely unaffected — the bypass only ever applies to
 * fabricated outcomes.
 *
 * Fails open: a missing header, or one naming a run that doesn't exist,
 * belongs to a different client, or is CLOSED, is treated identically — the
 * request proceeds normally, same fail-open philosophy fault injection
 * already documents for an out-of-whitelist value.
 */
export async function runInjection(req: Request, res: Response, next: NextFunction): Promise<void> {
  const runId = req.header(RUN_ID_HEADER);
  if (!runId) {
    next();
    return;
  }

  try {
    const run = await prisma.run.findUnique({ where: { id: runId } });
    if (!run || run.clientId !== req.client!.id || run.status !== 'ACTIVE') {
      next();
      return;
    }

    const distribution = run.distribution as unknown as DistributionEntry[];
    const status = pickOutcome(distribution);
    await recordEvent(run.id, status);

    if (status === 200) {
      next();
      return;
    }

    if (status === 429) {
      // Exactly the real rate limiter's own shape (src/middleware/rateLimiter.ts).
      res.set('Retry-After', '1').status(429).json({
        message: 'Too many requests — rate limit exceeded for this client.',
        retry_after_seconds: 1,
      });
      return;
    }

    if (status === 422) {
      // Fixed, generic shape — deliberately distinct from real field-level
      // validation errors, so a caller can recognize it as run-fabricated.
      res.status(422).json({
        message: 'The request contains invalid parameters',
        errors: {
          _run: [{ code: 1319, message: 'The request contains invalid parameters' }],
        },
      });
      return;
    }

    // 500/502/503/504 — exactly fault injection's own shape.
    res.status(status).json({
      message: FAULT_MESSAGES[status],
      correlationId: req.correlationId,
      injected: true,
    });
  } catch (error) {
    next(error);
  }
}
