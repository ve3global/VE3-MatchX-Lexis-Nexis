import { z } from 'zod';
import { chance, subSeed } from '../../../lib/determinism.js';
import type { FieldErrorCodeMap } from '../../../lib/validation.js';
import type { ActionContext, ActionModule } from './types.js';

const schema = z
  .object({
    telephone: z.string().max(255).optional(),
    extension: z.string().max(255).optional(),
    mobile: z.string().max(255).optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.telephone && !data.mobile) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['_phone'],
        message: 'The request contains invalid parameters',
        params: { code: 1319 },
      });
    }
  });

const errorCodes: FieldErrorCodeMap = {
  telephone: { string: 1304, max: 1307 },
  extension: { string: 1305, max: 1308 },
  mobile: { string: 1306, max: 1309 },
};

function build(ctx: ActionContext): Record<string, unknown> {
  const { telephone, mobile } = ctx.requestBody as { telephone?: string; mobile?: string };
  return {
    phone_match: chance(subSeed(ctx.seed, `phone-match:${telephone ?? ''}:${mobile ?? ''}`), 0.85),
  };
}

export const phoneMatch: ActionModule = { schema, errorCodes, build };
