import { z } from 'zod';
import type { FieldErrorCodeMap } from '../../lib/validation.js';

export const updateNotificationSchema = z.object({
  read: z.boolean(),
});

export type UpdateNotificationRequest = z.infer<typeof updateNotificationSchema>;

export const UPDATE_NOTIFICATION_ERROR_CODES: FieldErrorCodeMap = {
  read: { required: 1281, string: 1282 },
};

// z.coerce.boolean() would treat the query string "false" as truthy
// (non-empty string) — an explicit true/false string enum avoids that trap.
const booleanQueryParam = z
  .enum(['true', 'false'])
  .optional()
  .transform((value) => (value === undefined ? undefined : value === 'true'));

export const listNotificationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  per_page: z.coerce.number().int().min(1).max(100).optional().default(15),
  read: booleanQueryParam,
});

export const LIST_NOTIFICATIONS_ERROR_CODES: FieldErrorCodeMap = {
  page: { string: 1080, min: 1081 },
  per_page: { string: 1077, min: 1078, max: 1079 },
  read: { invalid: 1282 },
};
