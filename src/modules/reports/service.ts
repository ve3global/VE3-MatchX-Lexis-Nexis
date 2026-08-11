import type {
  Prisma,
  RemoteCheckTransaction,
  Report,
  ReportActionResult,
  Scorecard,
} from '@prisma/client';
import { chance, seedFrom, subSeed } from '../../lib/determinism.js';
import { prisma } from '../../lib/prisma.js';
import { singleFieldError } from '../../lib/validation.js';
import { ApiError, ValidationError } from '../../middleware/errorHandler.js';
import { createNotification } from '../notifications/service.js';
import { evaluateScorecard, type ScoreGroup } from '../../scoring/engine.js';
import { ACTION_REGISTRY } from './actions/registry.js';
import type { ActionSubject } from './actions/types.js';
import type { CreateReportRequest } from './schema.js';

type ReportWithRelations = Report & {
  scorecard: Scorecard | null;
  actionResults: ReportActionResult[];
};

function dateOnly(date: Date | null): string | null {
  return date ? date.toISOString().slice(0, 10) : null;
}

/** Root seed per constitution.md's determinism engine — same subject, same seed, every run, regardless of when/how many actions run against it. */
function subjectSeed(subject: ActionSubject): number {
  return seedFrom(
    subject.forename ?? '',
    subject.surname ?? '',
    subject.dob ?? '',
    subject.address?.postcode ?? '',
  );
}

export function serializeReport(report: ReportWithRelations) {
  const attributes: Record<string, unknown> = {};
  const actionsOutput: Record<string, unknown> = {};
  for (const result of report.actionResults) {
    actionsOutput[result.actionName] = result.resultPayload;
    if (typeof result.resultPayload === 'object' && result.resultPayload !== null) {
      Object.assign(attributes, result.resultPayload as Record<string, unknown>);
    }
  }

  const assessment =
    report.scorecardId && report.scorecard
      ? evaluateScorecard(
          {
            passThreshold: report.scorecard.passThreshold,
            failThreshold: report.scorecard.failThreshold,
            groups: report.scorecard.groups as unknown as ScoreGroup[],
          },
          attributes,
        )
      : null;

  return {
    id: report.id,
    report_type_id: report.reportTypeId,
    reference: report.reference,
    forename: report.forename,
    middlename: report.middlename,
    surname: report.surname,
    dob: dateOnly(report.dob),
    address: report.address,
    enduser_agreement: report.enduserAgreement,
    test: report.test,
    status: report.status,
    // Minimal doc-shaped stubs — no users/webhooks/context data exists in
    // phase 1 (see planning/constitution.md's phase-2 deferral list).
    user: {},
    context: {},
    annotations: {},
    assessment,
    attributes,
    ...actionsOutput,
    created_at: report.createdAt.toISOString(),
    updated_at: report.updatedAt.toISOString(),
  };
}

export async function createReport(
  clientId: string,
  input: CreateReportRequest,
): Promise<ReportWithRelations> {
  const reportType = input.report_type_id
    ? await prisma.reportType.findUnique({ where: { id: input.report_type_id } })
    : null;

  if (input.report_type_id) {
    if (!reportType || reportType.clientId !== clientId) {
      throw new ApiError(422, singleFieldError('report_type_id', 1319));
    }
    if (reportType.status === 'INACTIVE') {
      throw new ApiError(422, singleFieldError('report_type_id', 1319));
    }
    if (reportType.referenceRequired && !input.reference) {
      throw new ApiError(422, singleFieldError('reference', 1250));
    }
  }

  const subject: ActionSubject = {
    forename: input.forename,
    middlename: input.middlename,
    surname: input.surname,
    dob: input.dob,
    address: input.address,
  };
  const seed = subjectSeed(subject);

  // Only primary actions whose schema accepts an empty body can run
  // automatically at creation — anything needing its own input (bank
  // details, a passport MRZ, an OTP code, ...) has nowhere to get that
  // input from a report-creation request, and must be run individually
  // via POST /reports/{id}/actions/{action} once that data is available
  // (see spec.md's "Resolved conflicts").
  const actionRuns = (reportType?.primaryActions ?? []).flatMap((actionName) => {
    const module = ACTION_REGISTRY[actionName];
    if (!module) return [];
    const parsedBody = module.schema.safeParse({});
    if (!parsedBody.success) return [];
    return [
      {
        actionName,
        requestPayload: parsedBody.data,
        resultPayload: module.build({
          subject,
          requestBody: parsedBody.data,
          seed,
          priorResults: {},
        }),
      },
    ];
  });
  // Inline reports (no report type) never auto-complete — there's no
  // primary-actions list to have finished. A report_type_id report
  // completes only once every one of its primary actions has actually run.
  const status = reportType
    ? actionRuns.length === reportType.primaryActions.length
      ? 'COMPLETE'
      : 'STARTED'
    : 'STARTED';

  const created = await prisma.$transaction(async (tx) => {
    const report = await tx.report.create({
      data: {
        clientId,
        reportTypeId: reportType?.id,
        scorecardId: reportType?.scorecardId,
        forename: input.forename,
        middlename: input.middlename,
        surname: input.surname,
        dob: input.dob ? new Date(input.dob) : undefined,
        address: input.address,
        reference: input.reference,
        enduserAgreement: input.enduser_agreement ?? false,
        test: input.test ?? false,
        status,
      },
    });

    for (const run of actionRuns) {
      await tx.reportActionResult.create({
        data: {
          reportId: report.id,
          actionName: run.actionName,
          requestPayload: run.requestPayload as Prisma.InputJsonValue,
          resultPayload: run.resultPayload as Prisma.InputJsonValue,
        },
      });
    }

    await tx.reportAuditLog.create({
      data: {
        reportId: report.id,
        eventType: 'CREATED',
        message: reportType
          ? `Report created via report type "${reportType.name}"`
          : 'Report created inline',
      },
    });

    return report;
  });

  if (created.status === 'COMPLETE') {
    await createNotification(clientId, `Report "${created.id}" is now complete.`);
  }

  return findReport(clientId, created.id);
}

async function findReportRow(
  clientId: string,
  id: string,
  options: { includeDeleted?: boolean } = {},
): Promise<ReportWithRelations> {
  const report = await prisma.report.findUnique({
    where: { id },
    include: { scorecard: true, actionResults: true },
  });
  if (!report || report.clientId !== clientId || (!options.includeDeleted && report.deletedAt)) {
    throw new ApiError(404, { message: 'Not found' });
  }
  return report;
}

export async function findReport(clientId: string, id: string): Promise<ReportWithRelations> {
  return findReportRow(clientId, id);
}

export interface ListReportsFilters {
  forename?: string;
  surname?: string;
  dob?: string;
  status?: string;
  reference?: string;
  postcode?: string;
  date_from?: string;
  date_to?: string;
}

export async function listReports(
  clientId: string,
  filters: ListReportsFilters,
  page: number,
  perPage: number,
): Promise<{ items: ReportWithRelations[]; total: number }> {
  const where = {
    clientId,
    deletedAt: null,
    ...(filters.forename && {
      forename: { contains: filters.forename, mode: 'insensitive' as const },
    }),
    ...(filters.surname && {
      surname: { contains: filters.surname, mode: 'insensitive' as const },
    }),
    ...(filters.dob && { dob: new Date(filters.dob) }),
    ...(filters.status && { status: filters.status as 'STARTED' | 'PENDING' | 'COMPLETE' }),
    ...(filters.reference && {
      reference: { contains: filters.reference, mode: 'insensitive' as const },
    }),
    ...(filters.postcode && { address: { path: ['postcode'], string_contains: filters.postcode } }),
    ...((filters.date_from || filters.date_to) && {
      createdAt: {
        ...(filters.date_from && { gte: new Date(filters.date_from) }),
        ...(filters.date_to && { lte: new Date(filters.date_to) }),
      },
    }),
  };

  const [items, total] = await Promise.all([
    prisma.report.findMany({
      where,
      include: { scorecard: true, actionResults: true },
      orderBy: { createdAt: 'asc' },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.report.count({ where }),
  ]);
  return { items, total };
}

/** Doc-compliant soft-delete (see constitution.md) — externally indistinguishable from a hard delete; subsequent `GET` 404s. */
export async function deleteReport(clientId: string, id: string): Promise<void> {
  await findReport(clientId, id);
  await prisma.$transaction([
    prisma.report.update({ where: { id }, data: { deletedAt: new Date() } }),
    prisma.reportAuditLog.create({
      data: { reportId: id, eventType: 'DELETED', message: 'Report deleted' },
    }),
  ]);
}

/** Stays visible after a soft-delete (`includeDeleted`) — the deletion event itself belongs in the trail it's recording. */
export async function getAuditLog(clientId: string, id: string) {
  await findReportRow(clientId, id, { includeDeleted: true });
  return prisma.reportAuditLog.findMany({ where: { reportId: id }, orderBy: { createdAt: 'asc' } });
}

function maskAccountNumber(accountNumber: string): string {
  return accountNumber.length > 4
    ? `${'*'.repeat(accountNumber.length - 4)}${accountNumber.slice(-4)}`
    : accountNumber;
}

function maskNiNumber(niNumber: string): string {
  return niNumber.length > 3
    ? `${niNumber.slice(0, 2)}${'*'.repeat(niNumber.length - 3)}${niNumber.slice(-1)}`
    : niNumber;
}

/**
 * Echoes the submitted subject fields plus contact/sensitive data carried
 * by individual action calls, per the doc's "some sensitive information
 * may be redacted" note — bank account number masked to its last 4 digits,
 * NI number partially masked (see epic-7c's spec.md); everything else
 * (emails, phone numbers, passport data) is echoed as-is,
 * since only those two fields are called out for masking.
 */
export async function getInputData(clientId: string, id: string) {
  const report = await findReport(clientId, id);
  const data: Record<string, unknown> = {
    forename: report.forename,
    middlename: report.middlename,
    surname: report.surname,
    dob: dateOnly(report.dob),
    address: report.address,
    reference: report.reference,
  };

  for (const result of report.actionResults) {
    const payload = result.requestPayload as Record<string, unknown>;
    if (
      result.actionName === 'bank-account-validation' ||
      result.actionName === 'bank-account-verification'
    ) {
      const bankDetails = payload.bank_details as
        { sort_code: string; account_number: string } | undefined;
      if (bankDetails) {
        data.bank_details = {
          sort_code: bankDetails.sort_code,
          account_number: maskAccountNumber(bankDetails.account_number),
        };
      }
    } else if (
      result.actionName === 'ni-number-validation' &&
      typeof payload.ni_number === 'string'
    ) {
      data.ni_number = maskNiNumber(payload.ni_number);
    } else if (result.actionName === 'email-risk' && payload.emails) {
      data.emails = payload.emails;
    } else if (
      result.actionName === 'phone-match' ||
      result.actionName === 'phone-number-validation'
    ) {
      Object.assign(data, payload);
    } else if (result.actionName === 'passport-validation' && payload.passport) {
      data.passport = payload.passport;
    } else if (
      result.actionName === 'driving-licence-validation' &&
      payload.driving_licence_number
    ) {
      data.driving_licence_number = payload.driving_licence_number;
    }
  }

  return data;
}

/** Recomputes `status` after an action run — `COMPLETE` once every one of the report type's primary actions has a result row. */
async function recomputeStatus(reportId: string): Promise<void> {
  const report = await prisma.report.findUniqueOrThrow({
    where: { id: reportId },
    include: { reportType: true, actionResults: true },
  });
  if (!report.reportType || report.status === 'COMPLETE') {
    return;
  }
  const doneActions = new Set(report.actionResults.map((r) => r.actionName));
  const allDone = report.reportType.primaryActions.every((action) => doneActions.has(action));
  if (allDone) {
    await prisma.report.update({ where: { id: reportId }, data: { status: 'COMPLETE' } });
    await createNotification(report.clientId, `Report "${reportId}" is now complete.`);
  }
}

/**
 * `POST /reports/{id}/actions/{action}` (EPIC-7) — runs one action module
 * against an existing report, upserting its `ReportActionResult` by
 * `[reportId, actionName]` (a re-run overwrites), then recomputes `status`.
 */
export async function runAction(
  clientId: string,
  reportId: string,
  actionName: string,
  body: unknown,
): Promise<Record<string, unknown>> {
  const report = await findReport(clientId, reportId);
  const remoteCheckTransaction = await prisma.remoteCheckTransaction.findUnique({
    where: { reportId },
  });

  // EPIC-12: remote-check's own re-invocation gets the more specific doc
  // code (1313, "already completed") — checked *before* the generic
  // "report closed" guard below, so it isn't shadowed by it. Every other
  // action on a completed report gets the generic 1325 instead.
  if (actionName === 'remote-check') {
    return startRemoteCheck(report.id, remoteCheckTransaction);
  }

  if (remoteCheckTransaction?.status === 'COMPLETED') {
    throw new ApiError(422, singleFieldError('_report', 1325));
  }

  const module = ACTION_REGISTRY[actionName];
  if (!module) {
    throw new ApiError(404, { message: 'Not found' });
  }

  const parsed = module.schema.safeParse(body ?? {});
  if (!parsed.success) {
    throw new ValidationError(parsed.error, module.errorCodes);
  }

  const subject: ActionSubject = {
    forename: report.forename,
    middlename: report.middlename,
    surname: report.surname,
    dob: dateOnly(report.dob),
    address: report.address as ActionSubject['address'],
  };
  const priorResults: Record<string, Record<string, unknown>> = {};
  for (const result of report.actionResults) {
    priorResults[result.actionName] = result.resultPayload as Record<string, unknown>;
  }

  const resultPayload = module.build({
    subject,
    requestBody: parsed.data,
    seed: subjectSeed(subject),
    priorResults,
  });

  await prisma.$transaction([
    prisma.reportActionResult.upsert({
      where: { reportId_actionName: { reportId, actionName } },
      create: {
        reportId,
        actionName,
        requestPayload: parsed.data as Prisma.InputJsonValue,
        resultPayload: resultPayload as Prisma.InputJsonValue,
      },
      update: {
        requestPayload: parsed.data as Prisma.InputJsonValue,
        resultPayload: resultPayload as Prisma.InputJsonValue,
      },
    }),
    prisma.reportAuditLog.create({
      data: { reportId, eventType: 'ACTION_RUN', message: `Ran action "${actionName}"` },
    }),
  ]);

  await recomputeStatus(reportId);

  return resultPayload;
}

/**
 * EPIC-12: `remote-check`'s genuinely stateful lifecycle — one
 * transaction per report, ever (`@unique` on `reportId`). Starting
 * re-uses the same row once it's `CANCELLED`; re-invoking after
 * `COMPLETED` gets this action's own more specific doc code (1313) —
 * `runAction` checks for `remote-check` before its generic "report
 * closed" 1325 guard specifically so this branch isn't shadowed.
 */
async function startRemoteCheck(
  reportId: string,
  existing: RemoteCheckTransaction | null,
): Promise<Record<string, unknown>> {
  if (existing?.status === 'IN_PROGRESS') {
    throw new ApiError(422, singleFieldError('_remote_check', 1312));
  }
  if (existing?.status === 'COMPLETED') {
    throw new ApiError(422, singleFieldError('_remote_check', 1313));
  }

  const transaction = await prisma.remoteCheckTransaction.upsert({
    where: { reportId },
    create: { reportId, status: 'IN_PROGRESS' },
    update: { status: 'IN_PROGRESS', result: null },
  });
  await prisma.reportAuditLog.create({
    data: { reportId, eventType: 'ACTION_RUN', message: 'Started remote-check' },
  });

  return { remote_check_status: transaction.status };
}

/** `null` when no transaction was ever started — cancel/resend treat that the same as "wrong state" (their own doc codes say so, see callers); results/pdf treat it as 404 (nothing to report on at all). */
async function findRemoteCheckTransaction(
  clientId: string,
  reportId: string,
): Promise<RemoteCheckTransaction | null> {
  await findReport(clientId, reportId);
  return prisma.remoteCheckTransaction.findUnique({ where: { reportId } });
}

export async function cancelRemoteCheck(
  clientId: string,
  reportId: string,
): Promise<Record<string, unknown>> {
  const transaction = await findRemoteCheckTransaction(clientId, reportId);
  if (transaction?.status !== 'IN_PROGRESS') {
    throw new ApiError(422, singleFieldError('_remote_check', 1321));
  }
  const updated = await prisma.remoteCheckTransaction.update({
    where: { reportId },
    data: { status: 'CANCELLED' },
  });
  return { remote_check_status: updated.status };
}

export async function resendRemoteCheck(
  clientId: string,
  reportId: string,
): Promise<Record<string, unknown>> {
  const transaction = await findRemoteCheckTransaction(clientId, reportId);
  if (transaction?.status !== 'IN_PROGRESS') {
    throw new ApiError(422, singleFieldError('_remote_check', 1338));
  }
  const updated = await prisma.remoteCheckTransaction.update({ where: { reportId }, data: {} });
  return { remote_check_status: updated.status };
}

/**
 * Resolves an `IN_PROGRESS` transaction the first time anyone checks —
 * this replica has no real async journey to actually wait on, so "the
 * journey finished by the time you asked" is the honest stand-in (see
 * spec.md's "Resolved conflicts"). Idempotent: a `COMPLETED` transaction
 * just returns its already-resolved result on every subsequent call.
 */
export async function getRemoteCheckResults(
  clientId: string,
  reportId: string,
): Promise<Record<string, unknown>> {
  const transaction = await findRemoteCheckTransaction(clientId, reportId);
  if (!transaction) {
    throw new ApiError(404, { message: 'Not found' });
  }
  if (transaction.status !== 'IN_PROGRESS') {
    return { remote_check_status: transaction.status, remote_check_result: transaction.result };
  }

  const report = await findReport(clientId, reportId);
  const subject: ActionSubject = {
    forename: report.forename,
    surname: report.surname,
    dob: dateOnly(report.dob),
    address: report.address as ActionSubject['address'],
  };
  const passed = chance(subSeed(subjectSeed(subject), 'remote-check:passed'), 0.9);
  const result = passed ? 'PASS' : 'FAIL';

  await prisma.$transaction([
    prisma.remoteCheckTransaction.update({
      where: { reportId },
      data: { status: 'COMPLETED', result },
    }),
    prisma.reportActionResult.upsert({
      where: { reportId_actionName: { reportId, actionName: 'remote-check' } },
      create: {
        reportId,
        actionName: 'remote-check',
        requestPayload: {},
        resultPayload: { remote_check_completed: true, remote_check_result: result },
      },
      update: { resultPayload: { remote_check_completed: true, remote_check_result: result } },
    }),
  ]);
  await recomputeStatus(reportId);

  return { remote_check_status: 'COMPLETED', remote_check_result: result };
}

/** Stub payload, not real PDF bytes (see spec.md's "Resolved conflicts"). */
export async function getRemoteCheckPdf(
  clientId: string,
  reportId: string,
): Promise<Record<string, unknown>> {
  const transaction = await findRemoteCheckTransaction(clientId, reportId);
  if (transaction?.status !== 'COMPLETED') {
    throw new ApiError(422, singleFieldError('_remote_check', 1319));
  }
  return {
    content_type: 'application/pdf',
    filename: `remote-check-${reportId}.pdf`,
    note: 'Replica-only stub — not a real PDF (see epic-12-remote-check-lifecycle/spec.md).',
  };
}
