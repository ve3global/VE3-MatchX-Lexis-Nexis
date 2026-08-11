import { Router } from 'express';
import { paginate } from '../../lib/pagination.js';
import { ValidationError } from '../../middleware/errorHandler.js';
import {
  LIST_NOTIFICATIONS_ERROR_CODES,
  listNotificationsQuerySchema,
  UPDATE_NOTIFICATION_ERROR_CODES,
  updateNotificationSchema,
} from './schema.js';
import { listNotifications, serializeNotification, updateNotification } from './service.js';

export const notificationsRouter = Router();

notificationsRouter.get('/notifications', async (req, res, next) => {
  const parsed = listNotificationsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    next(new ValidationError(parsed.error, LIST_NOTIFICATIONS_ERROR_CODES));
    return;
  }
  try {
    const { page, per_page: perPage, read } = parsed.data;
    const { items, total } = await listNotifications(req.client!.id, read, page, perPage);
    res
      .status(200)
      .json(paginate(items.map(serializeNotification), total, page, perPage, '/notifications'));
  } catch (error) {
    next(error);
  }
});

notificationsRouter.patch('/notifications/:id', async (req, res, next) => {
  const parsed = updateNotificationSchema.safeParse(req.body);
  if (!parsed.success) {
    next(new ValidationError(parsed.error, UPDATE_NOTIFICATION_ERROR_CODES));
    return;
  }
  try {
    const notification = await updateNotification(req.client!.id, req.params.id, parsed.data);
    res.status(200).json(serializeNotification(notification));
  } catch (error) {
    next(error);
  }
});
