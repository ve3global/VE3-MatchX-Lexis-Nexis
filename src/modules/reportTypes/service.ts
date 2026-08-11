import type { ReportType } from '@prisma/client';
import { ApiError } from '../../middleware/errorHandler.js';
import { singleFieldError } from '../../lib/validation.js';
import { prisma } from '../../lib/prisma.js';
import type { CreateReportTypeRequest, UpdateReportTypeRequest } from './schema.js';

export function serializeReportType(reportType: ReportType) {
  return {
    id: reportType.id,
    name: reportType.name,
    description: reportType.description,
    scorecard_id: reportType.scorecardId,
    age_min: reportType.ageMin,
    age_max: reportType.ageMax,
    reference_required: reportType.referenceRequired,
    primary_actions: reportType.primaryActions,
    secondary_actions: reportType.secondaryActions,
    is_default: reportType.isDefault,
    category: reportType.category,
    status: reportType.status,
    created_at: reportType.createdAt.toISOString(),
    updated_at: reportType.updatedAt.toISOString(),
  };
}

async function assertNameAvailable(
  clientId: string,
  name: string,
  excludeId?: string,
): Promise<void> {
  const existing = await prisma.reportType.findUnique({
    where: { clientId_name: { clientId, name } },
  });
  if (existing && existing.id !== excludeId) {
    throw new ApiError(422, singleFieldError('name', 1327));
  }
}

/**
 * Rejects a nonexistent/foreign scorecard_id (1179) and, per constitution.md
 * ("Scorecard delete-while-attached"), a RETIRED one — EPIC-6's extension
 * lifecycle enforced here since a retired scorecard shouldn't be newly
 * assignable even though the doc has no such concept at all.
 */
async function assertScorecardExists(
  clientId: string,
  scorecardId: string | undefined,
): Promise<void> {
  if (!scorecardId) {
    return;
  }
  const scorecard = await prisma.scorecard.findUnique({ where: { id: scorecardId } });
  if (!scorecard || scorecard.clientId !== clientId || scorecard.status === 'RETIRED') {
    throw new ApiError(422, singleFieldError('scorecard_id', 1179));
  }
}

export async function createReportType(
  clientId: string,
  input: CreateReportTypeRequest,
): Promise<ReportType> {
  await assertNameAvailable(clientId, input.name);
  await assertScorecardExists(clientId, input.scorecard_id);

  return prisma.reportType.create({
    data: {
      clientId,
      name: input.name,
      description: input.description,
      scorecardId: input.scorecard_id,
      ageMin: input.age_min,
      ageMax: input.age_max,
      referenceRequired: input.reference_required ?? false,
      primaryActions: input.primary_actions,
      secondaryActions: input.secondary_actions,
      isDefault: input.is_default ?? false,
      category: input.category,
    },
  });
}

export async function listReportTypes(
  clientId: string,
  page: number,
  perPage: number,
): Promise<{ items: ReportType[]; total: number }> {
  const [items, total] = await Promise.all([
    prisma.reportType.findMany({
      where: { clientId },
      orderBy: { createdAt: 'asc' },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.reportType.count({ where: { clientId } }),
  ]);
  return { items, total };
}

export async function findReportType(clientId: string, id: string): Promise<ReportType> {
  const reportType = await prisma.reportType.findUnique({ where: { id } });
  if (!reportType || reportType.clientId !== clientId) {
    throw new ApiError(404, { message: 'Not found' });
  }
  return reportType;
}

export async function updateReportType(
  clientId: string,
  id: string,
  input: UpdateReportTypeRequest,
): Promise<ReportType> {
  const reportType = await findReportType(clientId, id);

  if (input.name !== undefined) {
    await assertNameAvailable(clientId, input.name, reportType.id);
  }
  if (input.scorecard_id !== undefined) {
    await assertScorecardExists(clientId, input.scorecard_id);
  }

  return prisma.reportType.update({
    where: { id },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.scorecard_id !== undefined && { scorecardId: input.scorecard_id }),
      ...(input.age_min !== undefined && { ageMin: input.age_min }),
      ...(input.age_max !== undefined && { ageMax: input.age_max }),
      ...(input.reference_required !== undefined && {
        referenceRequired: input.reference_required,
      }),
      ...(input.primary_actions !== undefined && { primaryActions: input.primary_actions }),
      ...(input.secondary_actions !== undefined && { secondaryActions: input.secondary_actions }),
      ...(input.is_default !== undefined && { isDefault: input.is_default }),
      ...(input.category !== undefined && { category: input.category }),
    },
  });
}

/**
 * Replica-only extension (see constitution.md) — the doc has no
 * active/inactive lifecycle on report types. `DELETE` deactivates rather
 * than removing the row, so `POST .../reactivate` has something to revert;
 * the doc's own `204 No Content` shape is preserved either way.
 */
export async function deactivateReportType(clientId: string, id: string): Promise<void> {
  await findReportType(clientId, id);
  await prisma.reportType.update({ where: { id }, data: { status: 'INACTIVE' } });
}

export async function reactivateReportType(clientId: string, id: string): Promise<ReportType> {
  await findReportType(clientId, id);
  return prisma.reportType.update({ where: { id }, data: { status: 'ACTIVE' } });
}
