import { z } from 'zod';
import { chance, subSeed } from '../../../lib/determinism.js';
import type { FieldErrorCodeMap } from '../../../lib/validation.js';
import type { ActionContext, ActionModule } from './types.js';

const schema = z
  .object({
    bank_details: z.object({
      sort_code: z.string(),
      account_number: z.string(),
    }),
  })
  .superRefine((data, ctx) => {
    if (!/^\d{6}$/.test(data.bank_details.sort_code)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['bank_details', 'sort_code'],
        message: 'The bank_details.sort_code must be 6 digits',
        params: { code: 1095 },
      });
    }
    if (!/^\d{8}$/.test(data.bank_details.account_number)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['bank_details', 'account_number'],
        message: 'The bank_details.account_number must be 8 digits',
        params: { code: 1098 },
      });
    }
  });

const errorCodes: FieldErrorCodeMap = {
  'bank_details.sort_code': { required: 1093, string: 1094 },
  'bank_details.account_number': { required: 1096, string: 1097 },
};

function build(ctx: ActionContext): Record<string, unknown> {
  const { sort_code, account_number } = ctx.requestBody.bank_details as {
    sort_code: string;
    account_number: string;
  };
  const bankSeed = subSeed(ctx.seed, `bank-account-validation:${sort_code}:${account_number}`);
  return {
    bank_account_valid: chance(subSeed(bankSeed, 'valid'), 0.9),
    bank_account_exists: chance(subSeed(bankSeed, 'exists'), 0.92),
  };
}

export const bankAccountValidation: ActionModule = { schema, errorCodes, build };
