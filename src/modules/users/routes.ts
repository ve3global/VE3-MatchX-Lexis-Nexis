import { Router } from 'express';
import { paginate } from '../../lib/pagination.js';
import { ValidationError } from '../../middleware/errorHandler.js';
import {
  ACTIVITY_LOGS_ERROR_CODES,
  activityLogsQuerySchema,
  COMPANY_ERROR_CODES,
  OPTIONS_ERROR_CODES,
  SELF_ERROR_CODES,
  updateCompanySchema,
  updateOptionsSchema,
  updateSelfSchema,
} from './schema.js';
import {
  getCompany,
  getOptions,
  getSelf,
  listActivityLogs,
  updateCompany,
  updateOptions,
  updateSelf,
} from './service.js';

export const usersRouter = Router();

usersRouter.get('/users/self', async (req, res, next) => {
  try {
    res.status(200).json(await getSelf(req.client!.id));
  } catch (error) {
    next(error);
  }
});

usersRouter.patch('/users/self', async (req, res, next) => {
  const parsed = updateSelfSchema.safeParse(req.body);
  if (!parsed.success) {
    next(new ValidationError(parsed.error, SELF_ERROR_CODES));
    return;
  }
  try {
    res.status(200).json(await updateSelf(req.client!.id, parsed.data));
  } catch (error) {
    next(error);
  }
});

usersRouter.get('/users/company', async (req, res, next) => {
  try {
    res.status(200).json(await getCompany(req.client!.id));
  } catch (error) {
    next(error);
  }
});

usersRouter.patch('/users/company', async (req, res, next) => {
  const parsed = updateCompanySchema.safeParse(req.body);
  if (!parsed.success) {
    next(new ValidationError(parsed.error, COMPANY_ERROR_CODES));
    return;
  }
  try {
    res.status(200).json(await updateCompany(req.client!.id, parsed.data));
  } catch (error) {
    next(error);
  }
});

usersRouter.get('/users/options', async (req, res, next) => {
  try {
    res.status(200).json(await getOptions(req.client!.id));
  } catch (error) {
    next(error);
  }
});

usersRouter.patch('/users/options', async (req, res, next) => {
  const parsed = updateOptionsSchema.safeParse(req.body);
  if (!parsed.success) {
    next(new ValidationError(parsed.error, OPTIONS_ERROR_CODES));
    return;
  }
  try {
    res.status(200).json(await updateOptions(req.client!.id, parsed.data));
  } catch (error) {
    next(error);
  }
});

usersRouter.get('/users/activity-logs', async (req, res, next) => {
  const parsed = activityLogsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    next(new ValidationError(parsed.error, ACTIVITY_LOGS_ERROR_CODES));
    return;
  }
  try {
    const { page, per_page: perPage, ...filters } = parsed.data;
    const { items, total } = await listActivityLogs(req.client!.id, filters, page, perPage);
    res.status(200).json(paginate(items, total, page, perPage, '/users/activity-logs'));
  } catch (error) {
    next(error);
  }
});
