import { z } from 'zod';
import type { FieldErrorCodeMap } from '../../lib/validation.js';

// "must have a valid SSL certificate" (1297) is a static https:// scheme
// check here, not a live TLS handshake — see spec.md's "Resolved conflicts".
const httpsUrl = z
  .string()
  .url({ message: 'The notification_webhook_url format is invalid' })
  .refine((url) => url.startsWith('https://'), {
    message: 'The notification_webhook_url must have a valid SSL certificate',
  });

export const createWebhookSchema = z.object({
  notification_webhook_url: httpsUrl,
  notification_webhook_secret: z.string().min(1),
});

export type CreateWebhookRequest = z.infer<typeof createWebhookSchema>;

export const updateWebhookSchema = z.object({
  notification_webhook_url: httpsUrl.optional(),
  notification_webhook_secret: z.string().min(1).optional(),
});

export type UpdateWebhookRequest = z.infer<typeof updateWebhookSchema>;

/**
 * `url()`'s own format failure (invalid_string, code 1295) and the
 * https-only `refine()` (a `custom` issue, code 1297 — the doc's SSL-cert
 * check) are two different Zod issue shapes on the same field, so both
 * need an entry. No dedicated "must be a string" code exists for either
 * field, so wrong-type falls back to the generic 1319.
 */
export const WEBHOOK_ERROR_CODES: FieldErrorCodeMap = {
  notification_webhook_url: { required: 1322, string: 1319, invalid: 1295, custom: 1297 },
  notification_webhook_secret: { required: 1323, string: 1319 },
};
