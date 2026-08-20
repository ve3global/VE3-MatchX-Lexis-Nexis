import { Router } from 'express';
import { paginate } from '../../lib/pagination.js';
import { ValidationError } from '../../middleware/errorHandler.js';
import {
  CREATE_REPORT_ERROR_CODES,
  createReportSchema,
  LIST_REPORTS_ERROR_CODES,
  listReportsQuerySchema,
} from './schema.js';
import {
  cancelRemoteCheck,
  createReport,
  deleteReport,
  findReport,
  getAuditLog,
  getInputData,
  getRemoteCheckPdf,
  getRemoteCheckResults,
  listReports,
  resendRemoteCheck,
  runAction,
  serializeReport,
} from './service.js';

export const reportsRouter = Router();

reportsRouter.post('/reports', async (req, res, next) => {
  const parsed = createReportSchema.safeParse(req.body);
  if (!parsed.success) {
    next(new ValidationError(parsed.error, CREATE_REPORT_ERROR_CODES));
    return;
  }
  try {
    const report = await createReport(req.client!.id, parsed.data);
    res.status(201).json({ data: serializeReport(report) });
  } catch (error) {
    next(error);
  }
});

reportsRouter.get('/reports', async (req, res, next) => {
  const parsed = listReportsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    next(new ValidationError(parsed.error, LIST_REPORTS_ERROR_CODES));
    return;
  }
  try {
    const { page, per_page: perPage, ...filters } = parsed.data;
    const { items, total } = await listReports(req.client!.id, filters, page, perPage);
    res.status(200).json(paginate(items.map(serializeReport), total, page, perPage, '/reports'));
  } catch (error) {
    next(error);
  }
});

reportsRouter.get('/reports/:id', async (req, res, next) => {
  try {
    const report = await findReport(req.client!.id, req.params.id);
    res.status(200).json({ data: serializeReport(report) });
  } catch (error) {
    next(error);
  }
});

reportsRouter.delete('/reports/:id', async (req, res, next) => {
  try {
    await deleteReport(req.client!.id, req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

reportsRouter.get('/reports/:id/audit', async (req, res, next) => {
  try {
    const log = await getAuditLog(req.client!.id, req.params.id);
    res.status(200).json({
      data: log.map((entry) => ({
        event_type: entry.eventType,
        message: entry.message,
        created_at: entry.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    next(error);
  }
});

reportsRouter.get('/reports/:id/input-data', async (req, res, next) => {
  try {
    const data = await getInputData(req.client!.id, req.params.id);
    res.status(200).json({ data });
  } catch (error) {
    next(error);
  }
});

// EPIC-7: runs one action module against an existing report.
reportsRouter.post('/reports/:id/actions/:action', async (req, res, next) => {
  try {
    const result = await runAction(req.client!.id, req.params.id, req.params.action, req.body);
    res.status(200).json({ data: { [req.params.action]: result } });
  } catch (error) {
    next(error);
  }
});

// EPIC-12: remote-check lifecycle sub-resource — a different path shape
// from the generic action-run route above, so no routing-order conflict.
reportsRouter.post('/reports/:id/actions/remote-check/cancel', async (req, res, next) => {
  try {
    const result = await cancelRemoteCheck(req.client!.id, req.params.id);
    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
});

reportsRouter.post('/reports/:id/actions/remote-check/resend', async (req, res, next) => {
  try {
    const result = await resendRemoteCheck(req.client!.id, req.params.id);
    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
});

reportsRouter.get('/reports/:id/actions/remote-check/results', async (req, res, next) => {
  try {
    const result = await getRemoteCheckResults(req.client!.id, req.params.id);
    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
});

reportsRouter.get('/reports/:id/actions/remote-check/pdf', async (req, res, next) => {
  try {
    const result = await getRemoteCheckPdf(req.client!.id, req.params.id);
    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
});
