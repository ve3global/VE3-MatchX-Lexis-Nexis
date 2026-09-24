import type { Run } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { ApiError } from '../../middleware/errorHandler.js';
import type { CreateRunRequest } from './schema.js';
import { RUN_STATUSES } from './schema.js';

export interface SerializedRun {
  run_id: string;
  distribution: { status: number; weight: number }[];
  expected_requests: number | null;
  status: 'ACTIVE' | 'CLOSED';
  tally: Record<string, number>;
  created_at: string;
  closed_at: string | null;
}

/** Every supported status is always present in the report, even at zero — so a caller never has to guess whether an absent key means "zero" or "not tracked". */
function zeroTally(): Record<string, number> {
  const tally: Record<string, number> = {};
  for (const status of RUN_STATUSES) {
    tally[String(status)] = 0;
  }
  return tally;
}

/**
 * Aggregated on read from the append-only RunEvent log (one row per roll,
 * never updated) via COUNT/GROUP BY, rather than a shared per-status
 * counter row — avoids one row taking an UPDATE lock on every single
 * tagged request under high-volume traffic (see prisma/schema.prisma's
 * RunEvent comment). A fresh run has no rows yet, so this is only worth
 * querying once at least one roll may have happened (findRun/closeRun);
 * createRun returns a zero tally directly instead.
 */
async function buildTally(runId: string): Promise<Record<string, number>> {
  const rows = await prisma.runEvent.groupBy({
    by: ['status'],
    where: { runId },
    _count: { _all: true },
  });
  const tally = zeroTally();
  for (const row of rows) {
    tally[String(row.status)] = row._count._all;
  }
  return tally;
}

export function serializeRun(run: Run, tally: Record<string, number>): SerializedRun {
  return {
    run_id: run.id,
    distribution: run.distribution as unknown as { status: number; weight: number }[],
    expected_requests: run.expectedRequests,
    status: run.status,
    tally,
    created_at: run.createdAt.toISOString(),
    closed_at: run.closedAt ? run.closedAt.toISOString() : null,
  };
}

export async function createRun(
  clientId: string,
  input: CreateRunRequest,
): Promise<{ run: Run; tally: Record<string, number> }> {
  const run = await prisma.run.create({
    data: {
      clientId,
      distribution: input.distribution,
      expectedRequests: input.expected_requests,
    },
  });
  return { run, tally: zeroTally() };
}

/** Not-found covers both a genuinely nonexistent run and one belonging to a different client — a run is never visible cross-client, same convention every other resource in this app follows. */
export async function findRun(
  clientId: string,
  id: string,
): Promise<{ run: Run; tally: Record<string, number> }> {
  const run = await prisma.run.findUnique({ where: { id } });
  if (!run || run.clientId !== clientId) {
    throw new ApiError(404, { message: 'Not found' });
  }
  return { run, tally: await buildTally(run.id) };
}

/** Replica-only extension (see constitution.md) — ACTIVE -> CLOSED; a no-op if already closed. The tally and run remain fetchable afterward via findRun. */
export async function closeRun(
  clientId: string,
  id: string,
): Promise<{ run: Run; tally: Record<string, number> }> {
  const { run, tally } = await findRun(clientId, id);
  if (run.status === 'CLOSED') {
    return { run, tally };
  }
  const updated = await prisma.run.update({
    where: { id },
    data: { status: 'CLOSED', closedAt: new Date() },
  });
  return { run: updated, tally };
}
