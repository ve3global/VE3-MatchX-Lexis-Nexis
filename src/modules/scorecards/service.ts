import type { Scorecard } from '@prisma/client';
import { ApiError } from '../../middleware/errorHandler.js';
import { prisma } from '../../lib/prisma.js';
import { singleFieldError } from '../../lib/validation.js';
import type { CreateScorecardRequest, UpdateScorecardRequest } from './schema.js';

export function serializeScorecard(scorecard: Scorecard) {
  return {
    id: scorecard.id,
    name: scorecard.name,
    pass_threshold: scorecard.passThreshold,
    fail_threshold: scorecard.failThreshold,
    groups: scorecard.groups,
    status: scorecard.status,
    version: scorecard.version,
    created_at: scorecard.createdAt.toISOString(),
    updated_at: scorecard.updatedAt.toISOString(),
  };
}

async function assertNameAvailable(
  clientId: string,
  name: string,
  excludeId?: string,
): Promise<void> {
  const existing = await prisma.scorecard.findUnique({
    where: { clientId_name: { clientId, name } },
  });
  if (existing && existing.id !== excludeId) {
    throw new ApiError(422, singleFieldError('name', 1326));
  }
}

export async function createScorecard(
  clientId: string,
  input: CreateScorecardRequest,
): Promise<Scorecard> {
  await assertNameAvailable(clientId, input.name);

  return prisma.scorecard.create({
    data: {
      clientId,
      name: input.name,
      passThreshold: input.pass_threshold,
      failThreshold: input.fail_threshold,
      groups: input.groups,
    },
  });
}

export async function listScorecards(
  clientId: string,
  page: number,
  perPage: number,
): Promise<{ items: Scorecard[]; total: number }> {
  const [items, total] = await Promise.all([
    prisma.scorecard.findMany({
      where: { clientId },
      orderBy: { createdAt: 'asc' },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.scorecard.count({ where: { clientId } }),
  ]);
  return { items, total };
}

export async function findScorecard(clientId: string, id: string): Promise<Scorecard> {
  const scorecard = await prisma.scorecard.findUnique({ where: { id } });
  if (!scorecard || scorecard.clientId !== clientId) {
    throw new ApiError(404, { message: 'Not found' });
  }
  return scorecard;
}

export async function updateScorecard(
  clientId: string,
  id: string,
  input: UpdateScorecardRequest,
): Promise<Scorecard> {
  const scorecard = await findScorecard(clientId, id);

  if (scorecard.status === 'RETIRED') {
    throw new ApiError(422, singleFieldError('_scorecard', 1319));
  }
  if (input.name !== undefined) {
    await assertNameAvailable(clientId, input.name, scorecard.id);
  }

  return prisma.scorecard.update({
    where: { id },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.pass_threshold !== undefined && { passThreshold: input.pass_threshold }),
      ...(input.fail_threshold !== undefined && { failThreshold: input.fail_threshold }),
      ...(input.groups !== undefined && { groups: input.groups }),
      version: { increment: 1 },
    },
  });
}

/**
 * Doc-compliant: `DELETE` on a scorecard still attached to a report type
 * returns 422/1241 verbatim (see constitution.md). Otherwise a real,
 * hard delete — the DRAFT/PUBLISHED/RETIRED lifecycle is a replica-only
 * extension layered on top, not a substitute for the doc's own delete
 * semantics.
 */
export async function deleteScorecard(clientId: string, id: string): Promise<void> {
  await findScorecard(clientId, id);

  const attachedCount = await prisma.reportType.count({ where: { scorecardId: id } });
  if (attachedCount > 0) {
    throw new ApiError(422, singleFieldError('scorecard_id', 1241));
  }

  await prisma.scorecard.delete({ where: { id } });
}

/** Replica-only extension (see constitution.md) — DRAFT -> PUBLISHED; a no-op if already published. */
export async function publishScorecard(clientId: string, id: string): Promise<Scorecard> {
  const scorecard = await findScorecard(clientId, id);
  if (scorecard.status === 'RETIRED') {
    throw new ApiError(422, singleFieldError('_scorecard', 1319));
  }
  if (scorecard.status === 'PUBLISHED') {
    return scorecard;
  }
  return prisma.scorecard.update({ where: { id }, data: { status: 'PUBLISHED' } });
}

/** Replica-only extension (see constitution.md) — DRAFT|PUBLISHED -> RETIRED; a no-op if already retired. */
export async function retireScorecard(clientId: string, id: string): Promise<Scorecard> {
  const scorecard = await findScorecard(clientId, id);
  if (scorecard.status === 'RETIRED') {
    return scorecard;
  }
  return prisma.scorecard.update({ where: { id }, data: { status: 'RETIRED' } });
}
