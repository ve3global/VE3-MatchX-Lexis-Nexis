import { Router } from 'express';
import { paginate, paginationQuerySchema, PAGINATION_ERROR_CODES } from '../../lib/pagination.js';
import { ValidationError } from '../../middleware/errorHandler.js';
import { createWebhookSchema, updateWebhookSchema, WEBHOOK_ERROR_CODES } from './schema.js';
import {
  createWebhook,
  deleteWebhook,
  findWebhook,
  listWebhooks,
  retryWebhook,
  rotateSecret,
  serializeDelivery,
  serializeWebhook,
  testWebhook,
  updateWebhook,
} from './service.js';

export const webhooksRouter = Router();

webhooksRouter.post('/webhooks', async (req, res, next) => {
  const parsed = createWebhookSchema.safeParse(req.body);
  if (!parsed.success) {
    next(new ValidationError(parsed.error, WEBHOOK_ERROR_CODES));
    return;
  }
  try {
    const webhook = await createWebhook(req.client!.id, parsed.data);
    res.status(201).json(serializeWebhook(webhook));
  } catch (error) {
    next(error);
  }
});

webhooksRouter.get('/webhooks', async (req, res, next) => {
  const parsed = paginationQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    next(new ValidationError(parsed.error, PAGINATION_ERROR_CODES));
    return;
  }
  try {
    const { page, per_page: perPage } = parsed.data;
    const { items, total } = await listWebhooks(req.client!.id, page, perPage);
    res.status(200).json(paginate(items.map(serializeWebhook), total, page, perPage, '/webhooks'));
  } catch (error) {
    next(error);
  }
});

webhooksRouter.get('/webhooks/:id', async (req, res, next) => {
  try {
    const webhook = await findWebhook(req.client!.id, req.params.id);
    res.status(200).json(serializeWebhook(webhook));
  } catch (error) {
    next(error);
  }
});

webhooksRouter.patch('/webhooks/:id', async (req, res, next) => {
  const parsed = updateWebhookSchema.safeParse(req.body);
  if (!parsed.success) {
    next(new ValidationError(parsed.error, WEBHOOK_ERROR_CODES));
    return;
  }
  try {
    const webhook = await updateWebhook(req.client!.id, req.params.id, parsed.data);
    res.status(200).json(serializeWebhook(webhook));
  } catch (error) {
    next(error);
  }
});

webhooksRouter.delete('/webhooks/:id', async (req, res, next) => {
  try {
    await deleteWebhook(req.client!.id, req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

webhooksRouter.post('/webhooks/:id/test', async (req, res, next) => {
  try {
    const delivery = await testWebhook(req.client!.id, req.params.id);
    res.status(200).json(serializeDelivery(delivery));
  } catch (error) {
    next(error);
  }
});

webhooksRouter.post('/webhooks/:id/retry', async (req, res, next) => {
  try {
    const delivery = await retryWebhook(req.client!.id, req.params.id);
    res.status(200).json(serializeDelivery(delivery));
  } catch (error) {
    next(error);
  }
});

webhooksRouter.post('/webhooks/:id/secret', async (req, res, next) => {
  try {
    const { webhook, secret } = await rotateSecret(req.client!.id, req.params.id);
    res.status(200).json({ ...serializeWebhook(webhook), notification_webhook_secret: secret });
  } catch (error) {
    next(error);
  }
});
