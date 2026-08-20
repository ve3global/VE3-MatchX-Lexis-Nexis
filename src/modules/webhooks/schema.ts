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

/** Replica-only extension — the doc has no endpoint for setting the URL itself (see spec.md). */
export const setWebhookUrlSchema = z.object({
  notification_webhook_url: httpsUrl,
});

export type SetWebhookUrlRequest = z.infer<typeof setWebhookUrlSchema>;

export const SET_WEBHOOK_URL_ERROR_CODES: FieldErrorCodeMap = {
  notification_webhook_url: { required: 1322, string: 1319, invalid: 1295, custom: 1297 },
};

export const WEBHOOK_EVENT_TYPES = [
  'remote-check.check-completed',
  'remote-check.invitation-expired',
] as const;

export const listWebhookMessagesQuerySchema = z
  .object({
    date_from: z.string().datetime(),
    date_to: z.string().datetime().optional(),
    page: z.coerce.number().int().min(1).optional().default(1),
    per_page: z.coerce.number().int().min(1).max(100).optional().default(15),
  })
  .superRefine((data, ctx) => {
    if (data.date_to !== undefined && data.date_to < data.date_from) {
      ctx.addIssue({
        code: 'custom',
        path: ['date_to'],
        message: 'The date_to must be a date after or equal to date_from',
        params: { code: 1300 },
      });
    }
  });

export type ListWebhookMessagesQuery = z.infer<typeof listWebhookMessagesQuerySchema>;

export const LIST_WEBHOOK_MESSAGES_ERROR_CODES: FieldErrorCodeMap = {
  date_from: { required: 1299, string: 1319, invalid: 1319 },
  date_to: { string: 1319, invalid: 1319 },
  page: { string: 1080, min: 1081 },
  per_page: { string: 1077, min: 1078, max: 1079 },
};

export const testWebhookSchema = z.object({
  valid_signature: z.boolean().optional().default(true),
  event_type: z.enum(WEBHOOK_EVENT_TYPES).optional(),
});

export type TestWebhookRequest = z.infer<typeof testWebhookSchema>;

export const TEST_WEBHOOK_ERROR_CODES: FieldErrorCodeMap = {
  valid_signature: { string: 1319 },
  event_type: { invalid: 1319 },
};
