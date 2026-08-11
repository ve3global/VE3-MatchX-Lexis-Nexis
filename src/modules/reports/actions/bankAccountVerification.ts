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

/** Distinct from bank-account-validation: checks the account-holder name (already on the report subject) matches the account, not just that the account itself is valid. */
function build(ctx: ActionContext): Record<string, unknown> {
  const { sort_code, account_number } = ctx.requestBody.bank_details as {
    sort_code: string;
    account_number: string;
  };
  const bankSeed = subSeed(
    ctx.seed,
    `bank-account-verification:${sort_code}:${account_number}:${ctx.subject.surname ?? ''}`,
  );
  return {
    bank_account_name_matches: chance(subSeed(bankSeed, 'name_matches'), 0.85),
    bank_account_verified: chance(subSeed(bankSeed, 'verified'), 0.85),
  };
}

export const bankAccountVerification: ActionModule = { schema, errorCodes, build };
