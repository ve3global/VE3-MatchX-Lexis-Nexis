import { z } from 'zod';
import type { FieldErrorCodeMap } from '../../lib/validation.js';
import { REPORT_ACTIONS } from '../../lib/reportActions.js';
import { paginationQuerySchema } from '../../lib/pagination.js';

function validateActionList(
  list: string[],
  field: 'primary_actions' | 'secondary_actions',
  codes: { notExist: number; duplicate: number },
  ctx: z.RefinementCtx,
): void {
  const seen = new Set<string>();
  for (const action of list) {
    if (!(REPORT_ACTIONS as readonly string[]).includes(action)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [field],
        message: `The ${action} report action does not exist`,
        params: { code: codes.notExist },
      });
    }
    if (seen.has(action)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [field],
        message: `The ${field} field has a duplicate value`,
        params: { code: codes.duplicate },
      });
    }
    seen.add(action);
  }
}

function validateNoOverlap(primary: string[], secondary: string[], ctx: z.RefinementCtx): void {
  for (const action of primary.filter((a) => secondary.includes(a))) {
    const message = `The ${action} report action cannot appear in both primary and secondary actions`;
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['primary_actions'],
      message,
      params: { code: 1347 },
    });
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['secondary_actions'],
      message,
      params: { code: 1348 },
    });
  }
}

function validateAgeRange(
  ageMin: number | undefined,
  ageMax: number | undefined,
  ctx: z.RefinementCtx,
): void {
  if (ageMin !== undefined && ageMax !== undefined && ageMin > ageMax) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['age_min'],
      message: 'The age_min must be less than or equal X',
      params: { code: 1119 },
    });
  }
}

const reportTypeFields = {
  name: z.string(),
  description: z.string().max(2000).optional(),
  scorecard_id: z.string().uuid().optional(),
  age_min: z.number().int().min(0).max(120).optional(),
  age_max: z.number().int().min(0).max(120).optional(),
  reference_required: z.boolean().optional(),
  primary_actions: z.array(z.string()).optional().default([]),
  secondary_actions: z.array(z.string()).optional().default([]),
  is_default: z.boolean().optional(),
  category: z.string().max(255).optional(),
};

export const createReportTypeSchema = z.object(reportTypeFields).superRefine((data, ctx) => {
  validateActionList(
    data.primary_actions,
    'primary_actions',
    { notExist: 1037, duplicate: 1038 },
    ctx,
  );
  validateActionList(
    data.secondary_actions,
    'secondary_actions',
    { notExist: 1344, duplicate: 1345 },
    ctx,
  );
  validateNoOverlap(data.primary_actions, data.secondary_actions, ctx);
  validateAgeRange(data.age_min, data.age_max, ctx);
});

export type CreateReportTypeRequest = z.infer<typeof createReportTypeSchema>;

export const updateReportTypeSchema = z
  .object(reportTypeFields)
  .partial()
  .superRefine((data, ctx) => {
    if (data.primary_actions) {
      validateActionList(
        data.primary_actions,
        'primary_actions',
        { notExist: 1037, duplicate: 1038 },
        ctx,
      );
    }
    if (data.secondary_actions) {
      validateActionList(
        data.secondary_actions,
        'secondary_actions',
        { notExist: 1344, duplicate: 1345 },
        ctx,
      );
    }
    if (data.primary_actions && data.secondary_actions) {
      validateNoOverlap(data.primary_actions, data.secondary_actions, ctx);
    }
    validateAgeRange(data.age_min, data.age_max, ctx);
  });

export type UpdateReportTypeRequest = z.infer<typeof updateReportTypeSchema>;

/**
 * Codes 1000-1002 (name), 1003-1004 (description) are the doc's dedicated
 * codes. `is_default`/`category` have no dedicated code anywhere in the
 * 1000-1348 table (neither field is referenced in the doc's own report-type
 * schema at all — see spec.md's "Resolved conflicts") so, per the EPIC-2/
 * EPIC-3 precedent, type failures on them fall back to the generic 1319.
 */
export const REPORT_TYPE_ERROR_CODES: FieldErrorCodeMap = {
  name: { required: 1001, string: 1000, max: 1002 },
  description: { string: 1003, max: 1004 },
  scorecard_id: { string: 1178, invalid: 1207 },
  age_min: { string: 1113, min: 1114, max: 1115 },
  age_max: { string: 1116, min: 1117, max: 1118 },
  reference_required: { string: 1251 },
  primary_actions: { string: 1036 },
  secondary_actions: { string: 1343 },
  is_default: { string: 1319 },
  category: { string: 1319, max: 1319 },
};

// Sortable columns — allow-listed against the serialized resource's own
// fields (see REPORT_TYPE_ORDER_COLUMNS in service.ts for the DB mapping).
export const REPORT_TYPE_ORDER_BY_VALUES = ['name', 'created_at'] as const;

export const listReportTypesQuerySchema = paginationQuerySchema.extend({
  // Filters by the requesting account's own profile username (see
  // service.ts) — a real, if narrow, filter: report types are already
  // scoped to the caller's client, and each client has exactly one
  // UserProfile in this replica, so it only ever matches "all of mine" or
  // "none" (see epic-5-report-types/spec.md's "Resolved conflicts").
  username: z.string().max(255).optional(),
  order_by: z.enum(REPORT_TYPE_ORDER_BY_VALUES).optional(),
  order: z.enum(['asc', 'desc']).optional(),
});

export type ListReportTypesQuery = z.infer<typeof listReportTypesQuerySchema>;

/**
 * `order`/`order_by` have no dedicated doc error code (like `is_default`/
 * `category` above) — an invalid value falls back to the generic 1319,
 * same precedent as this file's other undocumented-condition fields.
 */
export const LIST_REPORT_TYPES_ERROR_CODES: FieldErrorCodeMap = {
  page: { string: 1080, min: 1081 },
  per_page: { string: 1077, min: 1078, max: 1079 },
  username: { string: 1186, max: 1138 },
  order_by: { invalid: 1319 },
  order: { invalid: 1319 },
};
