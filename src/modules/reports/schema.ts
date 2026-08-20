import { z } from 'zod';
import type { FieldErrorCodeMap } from '../../lib/validation.js';

const INLINE_FIELDS = [
  'forename',
  'middlename',
  'surname',
  'dob',
  'address',
  'enduser_agreement',
] as const;

const addressSchema = z.object({
  address1: z.string().max(255).optional(),
  address2: z.string().max(255).optional(),
  address3: z.string().max(255).optional(),
  address4: z.string().max(255).optional(),
  address5: z.string().max(255).optional(),
  postcode: z.string().max(255).optional(),
});

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const createReportSchema = z
  .object({
    report_type_id: z.string().uuid().optional(),
    forename: z.string().max(255).optional(),
    middlename: z.string().max(255).optional(),
    surname: z.string().max(255).optional(),
    dob: z.string().optional(),
    address: addressSchema.optional(),
    reference: z.string().max(255).optional(),
    enduser_agreement: z.boolean().optional(),
    test: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.dob !== undefined && !DATE_RE.test(data.dob)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['dob'],
        message: 'The dob is not a valid date',
        params: { code: 1013 },
      });
    }

    if (data.report_type_id) {
      for (const field of INLINE_FIELDS) {
        if (data[field] !== undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [field],
            message: `The report_type_id field prohibits ${field} from being present`,
            params: { code: 1149 },
          });
        }
      }
      return;
    }

    // Inline mode — see spec.md's "Resolved conflicts": phase 1 has no
    // `lexid` (existing-identity lookup), so the doc's "required when
    // lexid is not present" codes (1052-1054) apply unconditionally here.
    if (data.forename === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['forename'],
        message: 'The forename field is required',
        params: { code: 1007 },
      });
    }
    if (data.surname === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['surname'],
        message: 'The surname field is required',
        params: { code: 1010 },
      });
    }
    if (data.enduser_agreement === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['enduser_agreement'],
        message: 'The enduser_agreement field is required',
        params: { code: 1055 },
      });
    }
    if (data.dob === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['dob'],
        message: 'The dob field is required when lexid is not present',
        params: { code: 1052 },
      });
    }
    if (!data.address?.address1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['address', 'address1'],
        message: 'The address.address1 field is required when lexid is not present',
        params: { code: 1053 },
      });
    }
    if (!data.address?.postcode) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['address', 'postcode'],
        message: 'The address.postcode field is required when lexid is not present',
        params: { code: 1054 },
      });
    }
  });

export type CreateReportRequest = z.infer<typeof createReportSchema>;

export const CREATE_REPORT_ERROR_CODES: FieldErrorCodeMap = {
  report_type_id: { string: 1006 },
  forename: { string: 1008, max: 1128 },
  middlename: { string: 1009, max: 1129 },
  surname: { string: 1011, max: 1130 },
  reference: { string: 1049, max: 1137 },
  enduser_agreement: { string: 1056 },
  test: { string: 1319 },
  'address.address1': { string: 1015, max: 1131 },
  'address.address2': { string: 1016, max: 1132 },
  'address.address3': { string: 1017, max: 1133 },
  'address.address4': { string: 1018, max: 1134 },
  'address.address5': { string: 1019, max: 1135 },
  'address.postcode': { string: 1021, max: 1136 },
};

export const listReportsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  per_page: z.coerce.number().int().min(1).max(100).optional().default(15),
  forename: z.string().optional(),
  surname: z.string().optional(),
  dob: z.string().regex(DATE_RE).optional(),
  status: z.enum(['STARTED', 'PENDING', 'COMPLETE']).optional(),
  reference: z.string().optional(),
  postcode: z.string().optional(),
  date_from: z.string().regex(DATE_RE).optional(),
  date_to: z.string().regex(DATE_RE).optional(),
  uklexid: z.coerce.number().int().optional(),
});

export const LIST_REPORTS_ERROR_CODES: FieldErrorCodeMap = {
  page: { string: 1080, min: 1081 },
  per_page: { string: 1077, min: 1078, max: 1079 },
  forename: { string: 1008 },
  surname: { string: 1011 },
  dob: { string: 1235, invalid: 1240 },
  status: { invalid: 1319 },
  reference: { string: 1049 },
  postcode: { string: 1032 },
  date_from: { string: 1319, invalid: 1319 },
  date_to: { string: 1319, invalid: 1300 },
  uklexid: { string: 1245 },
};
