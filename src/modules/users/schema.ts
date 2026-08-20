import { z } from 'zod';
import type { FieldErrorCodeMap } from '../../lib/validation.js';

const GENDERS = ['male', 'female', 'other', 'prefer_not_to_say'] as const;

export const updateSelfSchema = z.object({
  username: z
    .string()
    .max(255)
    .regex(/^[a-zA-Z0-9_.-]+$/, { message: 'The username format is invalid' })
    .optional(),
  gender: z
    .enum(GENDERS, { errorMap: () => ({ message: 'The selected gender is invalid' }) })
    .optional(),
  telephone: z
    .string()
    .max(255)
    .regex(/^[0-9+() -]+$/, { message: 'The telephone format is invalid' })
    .optional(),
  extension: z
    .string()
    .max(255)
    .regex(/^[0-9]+$/, { message: 'The extension format is invalid' })
    .optional(),
  mobile: z
    .string()
    .max(255)
    .regex(/^[0-9+() -]+$/, { message: 'The mobile format is invalid' })
    .optional(),
  webdev_email: z.string().email().max(255).optional(),
});

export type UpdateSelfRequest = z.infer<typeof updateSelfSchema>;

export const SELF_ERROR_CODES: FieldErrorCodeMap = {
  username: { string: 1186, max: 1138, invalid: 1314 },
  gender: { string: 1209, invalid: 1210 },
  telephone: { string: 1304, max: 1307, invalid: 1315 },
  extension: { string: 1305, max: 1308, invalid: 1316 },
  mobile: { string: 1306, max: 1309, invalid: 1317 },
  webdev_email: { string: 1319, max: 1310, invalid: 1311 },
};

export const updateCompanySchema = z.object({
  name: z.string().max(255).optional(),
});

export type UpdateCompanyRequest = z.infer<typeof updateCompanySchema>;

export const COMPANY_ERROR_CODES: FieldErrorCodeMap = {
  name: { string: 1000, max: 1002 },
};

const configSchema = z
  .object({
    full_er: z.boolean().optional(),
    age_min: z.number().int().min(0).max(120).optional(),
    age_max: z.number().int().min(0).max(120).optional(),
    nfi_address: z.boolean().optional(),
  })
  .optional();

export const updateOptionsSchema = z
  .object({
    bank_account_validation: z.boolean().optional(),
    driving_licence_validation: z.boolean().optional(),
    ni_number_validation: z.boolean().optional(),
    passport_validation: z.boolean().optional(),
    address_insights: z.boolean().optional(),
    address_lookup: z.boolean().optional(),
    remote_check: z.boolean().optional(),
    property_register_search: z.boolean().optional(),
    nfi_address: z.boolean().optional(),
    nfi_amberhill: z.boolean().optional(),
    email_risk: z.boolean().optional(),
    otp_email: z.boolean().optional(),
    otp_sms: z.boolean().optional(),
    phone_match: z.boolean().optional(),
    phone_number_validation: z.boolean().optional(),
    bankaccount: z.boolean().optional(),
    credit_activity: z.boolean().optional(),
    config: configSchema,
    bridger_client_id: z.string().max(255).optional(),
    bridger_client_secret: z.string().min(1).max(255).optional(),
    bridger_predefined_search: z.string().max(255).optional(),
    bridger_user_id: z.string().max(255).optional(),
    bridger_customer_toggle: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (
      data.config?.age_min !== undefined &&
      data.config.age_max !== undefined &&
      data.config.age_min > data.config.age_max
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['config', 'age_min'],
        message: 'The config.age_min must be less than the config.age_max',
        params: { code: 1197 },
      });
    }
  });

export type UpdateOptionsRequest = z.infer<typeof updateOptionsSchema>;

export const OPTIONS_ERROR_CODES: FieldErrorCodeMap = {
  bank_account_validation: { string: 1199 },
  driving_licence_validation: { string: 1200 },
  ni_number_validation: { string: 1201 },
  passport_validation: { string: 1202 },
  address_insights: { string: 1180 },
  address_lookup: { string: 1181 },
  remote_check: { string: 1265 },
  property_register_search: { string: 1266 },
  nfi_address: { string: 1253 },
  nfi_amberhill: { string: 1254 },
  email_risk: { string: 1104 },
  otp_email: { string: 1283 },
  otp_sms: { string: 1291 },
  phone_match: { string: 1298 },
  phone_number_validation: { string: 1302 },
  bankaccount: { string: 1099 },
  credit_activity: { string: 1048 },
  'config.full_er': { string: 1160 },
  'config.age_min': { string: 1205, min: 1193, max: 1194, custom: 1197 },
  'config.age_max': { string: 1206, min: 1195, max: 1196 },
  'config.nfi_address': { string: 1257 },
  bridger_client_id: { string: 1328, max: 1329 },
  bridger_client_secret: { string: 1330, max: 1331, min: 1337 },
  bridger_predefined_search: { string: 1332, max: 1333 },
  bridger_user_id: { string: 1334, max: 1335 },
  bridger_customer_toggle: { string: 1336 },
};

export const activityLogsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  per_page: z.coerce.number().int().min(1).max(100).optional().default(15),
  path_identifier: z.string().max(255).optional(),
  method: z.string().optional(),
  path: z.string().optional(),
  ip: z.string().max(255).optional(),
  status: z.coerce.number().int().optional(),
  application: z.string().optional(),
  level: z.string().optional(),
  channel: z.string().optional(),
  server_name: z.string().max(255).optional(),
});

/**
 * `path_identifier`/`ip`/`server_name` (1121/1124/1143 + max variants) were
 * previously unwired despite already being ActivityLog columns and
 * response fields (see serializeActivityLog) — best-effort completion,
 * see EPIC-11's spec.md.
 */
export const ACTIVITY_LOGS_ERROR_CODES: FieldErrorCodeMap = {
  page: { string: 1080, min: 1081 },
  per_page: { string: 1077, min: 1078, max: 1079 },
  path_identifier: { string: 1121, max: 1139 },
  method: { string: 1122, max: 1140 },
  path: { string: 1123, max: 1141 },
  ip: { string: 1124, max: 1142 },
  status: { string: 1125 },
  application: { string: 1154, max: 1155 },
  level: { string: 1156, max: 1157 },
  channel: { string: 1158, max: 1159 },
  server_name: { string: 1319, max: 1143 },
};
