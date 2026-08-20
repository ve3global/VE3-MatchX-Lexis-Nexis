import { Router } from 'express';
import { paginate } from '../../lib/pagination.js';
import { ValidationError } from '../../middleware/errorHandler.js';
import {
  LIST_WEBHOOK_MESSAGES_ERROR_CODES,
  listWebhookMessagesQuerySchema,
  SET_WEBHOOK_URL_ERROR_CODES,
  setWebhookUrlSchema,
  TEST_WEBHOOK_ERROR_CODES,
  testWebhookSchema,
} from './schema.js';
import {
  findMessage,
  listMessages,
  retryMessage,
  rotateSecret,
  sendTestMessage,
  serializeMessage,
  serializeMessageWithAttempts,
  setWebhookUrl,
} from './service.js';

export const webhooksRouter = Router();

// Replica-only extension (see spec.md's "Resolved conflicts") — the doc
// has no endpoint for configuring the URL itself, only rotating the
// secret once one exists.
webhooksRouter.put('/users/self/webhook-url', async (req, res, next) => {
  const parsed = setWebhookUrlSchema.safeParse(req.body);
  if (!parsed.success) {
    next(new ValidationError(parsed.error, SET_WEBHOOK_URL_ERROR_CODES));
    return;
  }
  try {
    await setWebhookUrl(req.client!.id, parsed.data.notification_webhook_url);
    res.status(200).json({ notification_webhook_url: parsed.data.notification_webhook_url });
  } catch (error) {
    next(error);
  }
});

webhooksRouter.put('/users/self/webhook-secret', async (req, res, next) => {
  try {
    const secret = await rotateSecret(req.client!.id);
    res.status(200).json({ secret });
  } catch (error) {
    next(error);
  }
});

webhooksRouter.get('/webhooks', async (req, res, next) => {
  const parsed = listWebhookMessagesQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    next(new ValidationError(parsed.error, LIST_WEBHOOK_MESSAGES_ERROR_CODES));
    return;
  }
  try {
    const { date_from: dateFrom, date_to: dateTo, page, per_page: perPage } = parsed.data;
    const { items, total } = await listMessages(req.client!.id, dateFrom, dateTo, page, perPage);
    res.status(200).json(paginate(items.map(serializeMessage), total, page, perPage, '/webhooks'));
  } catch (error) {
    next(error);
  }
});

webhooksRouter.get('/webhooks/:id', async (req, res, next) => {
  try {
    const message = await findMessage(req.client!.id, req.params.id);
    res.status(200).json(serializeMessageWithAttempts(message));
  } catch (error) {
    next(error);
  }
});

webhooksRouter.post('/webhooks/:id/retry', async (req, res, next) => {
  try {
    await retryMessage(req.client!.id, req.params.id);
    res.status(202).json({ message: 'Accepted' });
  } catch (error) {
    next(error);
  }
});

webhooksRouter.post('/webhooks/test', async (req, res, next) => {
  const parsed = testWebhookSchema.safeParse(req.body);
  if (!parsed.success) {
    next(new ValidationError(parsed.error, TEST_WEBHOOK_ERROR_CODES));
    return;
  }
  try {
    const result = await sendTestMessage(req.client!.id, parsed.data);
    res.status(result.http_status_code === 200 ? 200 : 500).json({ data: result });
  } catch (error) {
    next(error);
  }
});
