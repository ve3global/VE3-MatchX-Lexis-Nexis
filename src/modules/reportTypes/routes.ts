import { Router } from 'express';
import { paginate, paginationQuerySchema, PAGINATION_ERROR_CODES } from '../../lib/pagination.js';
import { ValidationError } from '../../middleware/errorHandler.js';
import {
  createReportTypeSchema,
  REPORT_TYPE_ERROR_CODES,
  updateReportTypeSchema,
} from './schema.js';
import {
  createReportType,
  deactivateReportType,
  findReportType,
  listReportTypes,
  reactivateReportType,
  serializeReportType,
  updateReportType,
} from './service.js';

export const reportTypesRouter = Router();

reportTypesRouter.post('/report-types', async (req, res, next) => {
  const parsed = createReportTypeSchema.safeParse(req.body);
  if (!parsed.success) {
    next(new ValidationError(parsed.error, REPORT_TYPE_ERROR_CODES));
    return;
  }
  try {
    const reportType = await createReportType(req.client!.id, parsed.data);
    res.status(201).json(serializeReportType(reportType));
  } catch (error) {
    next(error);
  }
});

reportTypesRouter.get('/report-types', async (req, res, next) => {
  const parsed = paginationQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    next(new ValidationError(parsed.error, PAGINATION_ERROR_CODES));
    return;
  }
  try {
    const { page, per_page: perPage } = parsed.data;
    const { items, total } = await listReportTypes(req.client!.id, page, perPage);
    res
      .status(200)
      .json(paginate(items.map(serializeReportType), total, page, perPage, '/report-types'));
  } catch (error) {
    next(error);
  }
});

reportTypesRouter.get('/report-types/:id', async (req, res, next) => {
  try {
    const reportType = await findReportType(req.client!.id, req.params.id);
    res.status(200).json(serializeReportType(reportType));
  } catch (error) {
    next(error);
  }
});

reportTypesRouter.patch('/report-types/:id', async (req, res, next) => {
  const parsed = updateReportTypeSchema.safeParse(req.body);
  if (!parsed.success) {
    next(new ValidationError(parsed.error, REPORT_TYPE_ERROR_CODES));
    return;
  }
  try {
    const reportType = await updateReportType(req.client!.id, req.params.id, parsed.data);
    res.status(200).json(serializeReportType(reportType));
  } catch (error) {
    next(error);
  }
});

reportTypesRouter.delete('/report-types/:id', async (req, res, next) => {
  try {
    await deactivateReportType(req.client!.id, req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// Replica-only extension (see constitution.md) — not part of the documented API.
reportTypesRouter.post('/report-types/:id/reactivate', async (req, res, next) => {
  try {
    const reportType = await reactivateReportType(req.client!.id, req.params.id);
    res.status(200).json(serializeReportType(reportType));
  } catch (error) {
    next(error);
  }
});
